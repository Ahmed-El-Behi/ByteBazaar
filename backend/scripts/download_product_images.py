
import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 Chrome/124 Safari/537.36",
    "Accept": "image/*,*/*;q=0.8",
}

def safe_name(value):
    return re.sub(
        r"[^a-zA-Z0-9_-]+", "-", str(value)
    ).strip("-")[:100] or "product"

def get_image_variants(url):
    variants = []

    for size in ("1200p", "800p", "500p"):
        candidate = re.sub(
            r"\.256p(?=\.(?:jpg|jpeg|png|webp)(?:$|\?))",
            f".{size}",
            url,
            flags=re.I,
        )

        if candidate != url:
            variants.append(candidate)

    variants.append(url)
    return list(dict.fromkeys(variants))

def download_image(url, destination, timeout):
    errors = []

    for candidate in get_image_variants(url):
        try:
            response = requests.get(
                candidate,
                headers=HEADERS,
                timeout=timeout,
            )

            if response.status_code != 200:
                errors.append(f"HTTP {response.status_code}")
                continue

            content_type = response.headers.get(
                "Content-Type", ""
            ).lower()

            if not content_type.startswith("image/"):
                errors.append("Ce n'est pas une image")
                continue

            data = response.content

            valid = (
                data.startswith(b"\xff\xd8\xff")
                or data.startswith(b"\x89PNG\r\n\x1a\n")
                or data[:4] == b"RIFF"
                or data[:4] == b"GIF8"
            )

            if len(data) < 1000 or not valid:
                errors.append("Image invalide")
                continue

            destination.parent.mkdir(
                parents=True, exist_ok=True
            )

            destination.write_bytes(data)

            return True, candidate, ""

        except requests.RequestException as error:
            errors.append(str(error))

    return False, "", "; ".join(errors[-3:])

def main():
    parser = argparse.ArgumentParser()

    parser.add_argument("--input", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--url-prefix", default="/products")
    parser.add_argument("--json-output", required=True)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--timeout", type=int, default=25)

    args = parser.parse_args()

    catalogue = json.loads(
        Path(args.input).read_text(encoding="utf-8")
    )

    output_dir = Path(args.output_dir)
    jobs = []

    for product in catalogue.get("products", []):
        for image in product.get("images", []):
            url = image.get("url", "")

            if not url.startswith(("http://", "https://")):
                continue

            extension = Path(
                urlparse(url).path
            ).suffix.lower()

            if extension not in (".jpg", ".jpeg", ".png", ".webp"):
                extension = ".jpg"

            filename = (
                safe_name(product.get("sku", "product"))
                + extension
            )

            relative_path = (
                Path(safe_name(product.get("categorySlug", "misc")))
                / filename
            )

            destination = output_dir / relative_path

            public_url = (
                args.url_prefix.rstrip("/")
                + "/"
                + relative_path.as_posix()
            )

            jobs.append((
                product,
                image,
                url,
                destination,
                public_url,
            ))

    print(f"Images à télécharger : {len(jobs)}")

    success_count = 0
    failures = []

    with ThreadPoolExecutor(
        max_workers=max(1, args.workers)
    ) as executor:

        futures = {
            executor.submit(
                download_image,
                url,
                destination,
                args.timeout,
            ): (product, image, public_url)

            for product, image, url, destination, public_url
            in jobs
        }

        for index, future in enumerate(
            as_completed(futures), 1
        ):
            product, image, public_url = futures[future]

            success, downloaded_url, error = future.result()

            if success:
                image["url"] = public_url
                success_count += 1
            else:
                failures.append({
                    "sku": product.get("sku"),
                    "name": product.get("name"),
                    "url": image.get("url"),
                    "error": error,
                })

            if index % 100 == 0 or index == len(jobs):
                print(
                    f"{index}/{len(jobs)} "
                    f"| téléchargées : {success_count} "
                    f"| échecs : {len(failures)}"
                )

    json_output = Path(args.json_output)
    json_output.parent.mkdir(parents=True, exist_ok=True)

    json_output.write_text(
        json.dumps(catalogue, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    report_path = json_output.with_name(
        json_output.stem + "_images_report.json"
    )

    report_path.write_text(
        json.dumps({
            "total": len(jobs),
            "downloaded": success_count,
            "failed": len(failures),
            "failures": failures,
        }, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("\n========== TERMINÉ ==========")
    print(f"Images téléchargées : {success_count}/{len(jobs)}")
    print(f"JSON local : {json_output}")
    print(f"Rapport : {report_path}")

if __name__ == "__main__":
    main()
