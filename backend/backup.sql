--
-- PostgreSQL database dump
--

\restrict ReNoeGV8smvUu5jaxXnCll198eFj8AbDEdoyjzdrSc7iZeEGiimVcNiqBhXGMLg

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: FormFactor; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."FormFactor" AS ENUM (
    'ATX',
    'MICRO_ATX',
    'MINI_ITX',
    'E_ATX'
);


ALTER TYPE public."FormFactor" OWNER TO postgres;

--
-- Name: Language; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Language" AS ENUM (
    'FR',
    'EN'
);


ALTER TYPE public."Language" OWNER TO postgres;

--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'PREPARING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED'
);


ALTER TYPE public."OrderStatus" OWNER TO postgres;

--
-- Name: PaymentMethod; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PaymentMethod" AS ENUM (
    'CASH_ON_DELIVERY',
    'BANK_TRANSFER',
    'CARD'
);


ALTER TYPE public."PaymentMethod" OWNER TO postgres;

--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'PENDING',
    'PAID',
    'FAILED',
    'REFUNDED'
);


ALTER TYPE public."PaymentStatus" OWNER TO postgres;

--
-- Name: RamType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."RamType" AS ENUM (
    'DDR4',
    'DDR5'
);


ALTER TYPE public."RamType" OWNER TO postgres;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Role" AS ENUM (
    'CUSTOMER',
    'ADMIN'
);


ALTER TYPE public."Role" OWNER TO postgres;

--
-- Name: StockReason; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."StockReason" AS ENUM (
    'RESTOCK',
    'SALE',
    'RETURN',
    'ADJUSTMENT'
);


ALTER TYPE public."StockReason" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Address; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Address" (
    id integer NOT NULL,
    label text NOT NULL,
    "recipientName" text NOT NULL,
    phone text NOT NULL,
    street text NOT NULL,
    city text NOT NULL,
    governorate text NOT NULL,
    "postalCode" text NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "userId" integer NOT NULL
);


ALTER TABLE public."Address" OWNER TO postgres;

--
-- Name: Address_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Address_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Address_id_seq" OWNER TO postgres;

--
-- Name: Address_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Address_id_seq" OWNED BY public."Address".id;


--
-- Name: Brand; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Brand" (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    "logoUrl" text
);


ALTER TABLE public."Brand" OWNER TO postgres;

--
-- Name: Brand_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Brand_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Brand_id_seq" OWNER TO postgres;

--
-- Name: Brand_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Brand_id_seq" OWNED BY public."Brand".id;


--
-- Name: Cart; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Cart" (
    id integer NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "userId" integer NOT NULL
);


ALTER TABLE public."Cart" OWNER TO postgres;

--
-- Name: CartItem; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."CartItem" (
    id integer NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    "cartId" integer NOT NULL,
    "productId" integer NOT NULL
);


ALTER TABLE public."CartItem" OWNER TO postgres;

--
-- Name: CartItem_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."CartItem_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."CartItem_id_seq" OWNER TO postgres;

--
-- Name: CartItem_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."CartItem_id_seq" OWNED BY public."CartItem".id;


--
-- Name: Cart_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Cart_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Cart_id_seq" OWNER TO postgres;

--
-- Name: Cart_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Cart_id_seq" OWNED BY public."Cart".id;


--
-- Name: Category; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Category" (
    id integer NOT NULL,
    slug text NOT NULL,
    "nameFr" text NOT NULL,
    "nameEn" text NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "parentId" integer
);


ALTER TABLE public."Category" OWNER TO postgres;

--
-- Name: Category_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Category_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Category_id_seq" OWNER TO postgres;

--
-- Name: Category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Category_id_seq" OWNED BY public."Category".id;


--
-- Name: Configuration; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Configuration" (
    id integer NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "userId" integer NOT NULL
);


ALTER TABLE public."Configuration" OWNER TO postgres;

--
-- Name: ConfigurationItem; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ConfigurationItem" (
    id integer NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    "configurationId" integer NOT NULL,
    "productId" integer NOT NULL
);


ALTER TABLE public."ConfigurationItem" OWNER TO postgres;

--
-- Name: ConfigurationItem_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."ConfigurationItem_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ConfigurationItem_id_seq" OWNER TO postgres;

--
-- Name: ConfigurationItem_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."ConfigurationItem_id_seq" OWNED BY public."ConfigurationItem".id;


--
-- Name: Configuration_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Configuration_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Configuration_id_seq" OWNER TO postgres;

--
-- Name: Configuration_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Configuration_id_seq" OWNED BY public."Configuration".id;


--
-- Name: Cpu; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Cpu" (
    "productId" integer NOT NULL,
    socket text NOT NULL,
    cores integer NOT NULL,
    threads integer NOT NULL,
    "baseClockGHz" numeric(4,2) NOT NULL,
    "boostClockGHz" numeric(4,2),
    "tdpWatts" integer NOT NULL,
    "hasIntegratedGraphics" boolean NOT NULL
);


ALTER TABLE public."Cpu" OWNER TO postgres;

--
-- Name: Gpu; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Gpu" (
    "productId" integer NOT NULL,
    chipset text NOT NULL,
    "vramGB" integer NOT NULL,
    "tdpWatts" integer NOT NULL,
    "lengthMm" integer NOT NULL,
    "recommendedPsuWatts" integer
);


ALTER TABLE public."Gpu" OWNER TO postgres;

--
-- Name: Motherboard; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Motherboard" (
    "productId" integer NOT NULL,
    socket text NOT NULL,
    chipset text NOT NULL,
    "formFactor" public."FormFactor" NOT NULL,
    "ramType" public."RamType" NOT NULL,
    "ramSlots" integer NOT NULL,
    "maxRamGB" integer NOT NULL
);


ALTER TABLE public."Motherboard" OWNER TO postgres;

--
-- Name: Order; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Order" (
    id integer NOT NULL,
    reference text NOT NULL,
    status public."OrderStatus" DEFAULT 'PENDING'::public."OrderStatus" NOT NULL,
    "paymentMethod" public."PaymentMethod" NOT NULL,
    "paymentStatus" public."PaymentStatus" DEFAULT 'PENDING'::public."PaymentStatus" NOT NULL,
    subtotal numeric(12,3) NOT NULL,
    "shippingFee" numeric(12,3) NOT NULL,
    total numeric(12,3) NOT NULL,
    "shippingName" text NOT NULL,
    "shippingPhone" text NOT NULL,
    "shippingAddress" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "paidAt" timestamp(3) without time zone,
    "shippedAt" timestamp(3) without time zone,
    "deliveredAt" timestamp(3) without time zone,
    "userId" integer NOT NULL
);


ALTER TABLE public."Order" OWNER TO postgres;

--
-- Name: OrderItem; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."OrderItem" (
    id integer NOT NULL,
    "productName" text NOT NULL,
    "unitPrice" numeric(12,3) NOT NULL,
    quantity integer NOT NULL,
    "orderId" integer NOT NULL,
    "productId" integer NOT NULL
);


ALTER TABLE public."OrderItem" OWNER TO postgres;

--
-- Name: OrderItem_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."OrderItem_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."OrderItem_id_seq" OWNER TO postgres;

--
-- Name: OrderItem_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."OrderItem_id_seq" OWNED BY public."OrderItem".id;


--
-- Name: Order_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Order_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Order_id_seq" OWNER TO postgres;

--
-- Name: Order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Order_id_seq" OWNED BY public."Order".id;


--
-- Name: PcCase; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PcCase" (
    "productId" integer NOT NULL,
    "supportedFormFactors" public."FormFactor"[],
    "maxGpuLengthMm" integer NOT NULL
);


ALTER TABLE public."PcCase" OWNER TO postgres;

--
-- Name: PowerSupply; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PowerSupply" (
    "productId" integer NOT NULL,
    wattage integer NOT NULL,
    efficiency text NOT NULL,
    "isModular" boolean NOT NULL
);


ALTER TABLE public."PowerSupply" OWNER TO postgres;

--
-- Name: Product; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Product" (
    id integer NOT NULL,
    sku text NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    "descriptionFr" text NOT NULL,
    "descriptionEn" text NOT NULL,
    price numeric(12,3) NOT NULL,
    "stockQuantity" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "categoryId" integer NOT NULL,
    "brandId" integer NOT NULL
);


ALTER TABLE public."Product" OWNER TO postgres;

--
-- Name: ProductImage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ProductImage" (
    id integer NOT NULL,
    url text NOT NULL,
    "altText" text,
    "position" integer DEFAULT 0 NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL,
    "productId" integer NOT NULL
);


ALTER TABLE public."ProductImage" OWNER TO postgres;

--
-- Name: ProductImage_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."ProductImage_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ProductImage_id_seq" OWNER TO postgres;

--
-- Name: ProductImage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."ProductImage_id_seq" OWNED BY public."ProductImage".id;


--
-- Name: ProductSpec; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ProductSpec" (
    id integer NOT NULL,
    name text NOT NULL,
    "valueText" text NOT NULL,
    "valueNumber" numeric(14,3),
    unit text,
    "productId" integer NOT NULL
);


ALTER TABLE public."ProductSpec" OWNER TO postgres;

--
-- Name: ProductSpec_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."ProductSpec_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ProductSpec_id_seq" OWNER TO postgres;

--
-- Name: ProductSpec_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."ProductSpec_id_seq" OWNED BY public."ProductSpec".id;


--
-- Name: Product_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Product_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Product_id_seq" OWNER TO postgres;

--
-- Name: Product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Product_id_seq" OWNED BY public."Product".id;


--
-- Name: Ram; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Ram" (
    "productId" integer NOT NULL,
    type public."RamType" NOT NULL,
    "capacityGB" integer NOT NULL,
    modules integer NOT NULL,
    "speedMHz" integer NOT NULL
);


ALTER TABLE public."Ram" OWNER TO postgres;

--
-- Name: StockMovement; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."StockMovement" (
    id integer NOT NULL,
    "quantityChange" integer NOT NULL,
    reason public."StockReason" NOT NULL,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "productId" integer NOT NULL,
    "performedById" integer
);


ALTER TABLE public."StockMovement" OWNER TO postgres;

--
-- Name: StockMovement_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."StockMovement_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."StockMovement_id_seq" OWNER TO postgres;

--
-- Name: StockMovement_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."StockMovement_id_seq" OWNED BY public."StockMovement".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    phone text,
    role public."Role" DEFAULT 'CUSTOMER'::public."Role" NOT NULL,
    language public."Language" DEFAULT 'FR'::public."Language" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."User_id_seq" OWNER TO postgres;

--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: Address id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Address" ALTER COLUMN id SET DEFAULT nextval('public."Address_id_seq"'::regclass);


--
-- Name: Brand id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Brand" ALTER COLUMN id SET DEFAULT nextval('public."Brand_id_seq"'::regclass);


--
-- Name: Cart id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Cart" ALTER COLUMN id SET DEFAULT nextval('public."Cart_id_seq"'::regclass);


--
-- Name: CartItem id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CartItem" ALTER COLUMN id SET DEFAULT nextval('public."CartItem_id_seq"'::regclass);


--
-- Name: Category id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Category" ALTER COLUMN id SET DEFAULT nextval('public."Category_id_seq"'::regclass);


--
-- Name: Configuration id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Configuration" ALTER COLUMN id SET DEFAULT nextval('public."Configuration_id_seq"'::regclass);


--
-- Name: ConfigurationItem id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ConfigurationItem" ALTER COLUMN id SET DEFAULT nextval('public."ConfigurationItem_id_seq"'::regclass);


--
-- Name: Order id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Order" ALTER COLUMN id SET DEFAULT nextval('public."Order_id_seq"'::regclass);


--
-- Name: OrderItem id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderItem" ALTER COLUMN id SET DEFAULT nextval('public."OrderItem_id_seq"'::regclass);


--
-- Name: Product id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Product" ALTER COLUMN id SET DEFAULT nextval('public."Product_id_seq"'::regclass);


--
-- Name: ProductImage id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ProductImage" ALTER COLUMN id SET DEFAULT nextval('public."ProductImage_id_seq"'::regclass);


--
-- Name: ProductSpec id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ProductSpec" ALTER COLUMN id SET DEFAULT nextval('public."ProductSpec_id_seq"'::regclass);


--
-- Name: StockMovement id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."StockMovement" ALTER COLUMN id SET DEFAULT nextval('public."StockMovement_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Data for Name: Address; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Address" (id, label, "recipientName", phone, street, city, governorate, "postalCode", "isDefault", "userId") FROM stdin;
1	Domicile							f	2
2	Domicile							f	2
3	Domicile							f	2
4	Domicile							f	2
\.


--
-- Data for Name: Brand; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Brand" (id, name, slug, "logoUrl") FROM stdin;
1	AMD	amd	\N
2	Intel	intel	\N
3	ASUS	asus	\N
4	Gigabyte	gigabyte	\N
5	MSI	msi	\N
6	Corsair	corsair	\N
7	Kingston	kingston	\N
8	G.Skill	gskill	\N
9	Sapphire	sapphire	\N
10	NZXT	nzxt	\N
11	Cooler Master	cooler-master	\N
12	Logitech	logitech	\N
13	Redragon	redragon	\N
14	AOC	aoc	\N
\.


--
-- Data for Name: Cart; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Cart" (id, "updatedAt", "userId") FROM stdin;
1	2026-11-04 19:51:10.892	2
\.


--
-- Data for Name: CartItem; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."CartItem" (id, quantity, "cartId", "productId") FROM stdin;
1	1	1	24
2	3	1	19
3	1	1	7
4	1	1	22
\.


--
-- Data for Name: Category; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Category" (id, slug, "nameFr", "nameEn", "sortOrder", "parentId") FROM stdin;
1	composants	Composants PC	PC components	1	\N
2	peripheriques	Périphériques	Peripherals	2	\N
3	processeurs	Processeurs	Processors	1	1
4	cartes-meres	Cartes mères	Motherboards	2	1
5	memoire-ram	Mémoire RAM	Memory (RAM)	3	1
6	cartes-graphiques	Cartes graphiques	Graphics cards	4	1
7	alimentations	Alimentations	Power supplies	5	1
8	boitiers	Boîtiers	PC cases	6	1
9	souris	Souris	Mice	1	2
10	claviers	Claviers	Keyboards	2	2
11	ecrans	Écrans	Monitors	3	2
\.


--
-- Data for Name: Configuration; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Configuration" (id, name, "createdAt", "updatedAt", "userId") FROM stdin;
\.


--
-- Data for Name: ConfigurationItem; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ConfigurationItem" (id, quantity, "configurationId", "productId") FROM stdin;
\.


--
-- Data for Name: Cpu; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Cpu" ("productId", socket, cores, threads, "baseClockGHz", "boostClockGHz", "tdpWatts", "hasIntegratedGraphics") FROM stdin;
1	AM5	6	12	3.80	5.10	65	t
2	AM5	8	16	4.50	5.40	105	t
3	LGA1700	10	16	2.50	4.60	65	f
4	LGA1700	16	24	3.40	5.40	125	t
\.


--
-- Data for Name: Gpu; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Gpu" ("productId", chipset, "vramGB", "tdpWatts", "lengthMm", "recommendedPsuWatts") FROM stdin;
13	NVIDIA GeForce RTX 4060	8	115	227	550
14	AMD Radeon RX 7600	8	165	240	550
15	NVIDIA GeForce RTX 4070 SUPER	12	220	242	650
\.


--
-- Data for Name: Motherboard; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Motherboard" ("productId", socket, chipset, "formFactor", "ramType", "ramSlots", "maxRamGB") FROM stdin;
5	AM5	B650	ATX	DDR5	4	192
6	AM5	B650	MICRO_ATX	DDR5	4	192
7	LGA1700	B760	MICRO_ATX	DDR4	2	64
8	LGA1700	Z790	ATX	DDR5	4	192
\.


--
-- Data for Name: Order; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Order" (id, reference, status, "paymentMethod", "paymentStatus", subtotal, "shippingFee", total, "shippingName", "shippingPhone", "shippingAddress", "createdAt", "updatedAt", "paidAt", "shippedAt", "deliveredAt", "userId") FROM stdin;
\.


--
-- Data for Name: OrderItem; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."OrderItem" (id, "productName", "unitPrice", quantity, "orderId", "productId") FROM stdin;
\.


--
-- Data for Name: PcCase; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PcCase" ("productId", "supportedFormFactors", "maxGpuLengthMm") FROM stdin;
19	{ATX,MICRO_ATX,MINI_ITX}	365
20	{ATX,MICRO_ATX,MINI_ITX}	360
21	{MICRO_ATX,MINI_ITX}	360
\.


--
-- Data for Name: PowerSupply; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PowerSupply" ("productId", wattage, efficiency, "isModular") FROM stdin;
16	550	80 Plus Bronze	f
17	650	80 Plus Bronze	f
18	750	80 Plus Gold	t
\.


--
-- Data for Name: Product; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Product" (id, sku, slug, name, "descriptionFr", "descriptionEn", price, "stockQuantity", "isActive", "createdAt", "updatedAt", "categoryId", "brandId") FROM stdin;
1	CPU-AMD-R5-7600	amd-ryzen-5-7600	AMD Ryzen 5 7600	Processeur 6 cœurs AM5 avec graphique intégré, idéal pour le jeu en 1080p.	6-core AM5 processor with integrated graphics, ideal for 1080p gaming.	849.000	15	t	2026-11-03 21:19:19.843	2026-11-03 21:19:19.843	3	1
2	CPU-AMD-R7-7700X	amd-ryzen-7-7700x	AMD Ryzen 7 7700X	Processeur 8 cœurs AM5 très rapide, pour le jeu et la création de contenu.	Fast 8-core AM5 processor for gaming and content creation.	1150.000	10	t	2026-11-03 21:19:19.854	2026-11-03 21:19:19.854	3	1
3	CPU-INT-I5-13400F	intel-core-i5-13400f	Intel Core i5-13400F	Processeur 10 cœurs LGA1700, excellent rapport qualité/prix. Sans graphique intégré.	10-core LGA1700 processor with great value. No integrated graphics.	729.000	20	t	2026-11-03 21:19:19.859	2026-11-03 21:19:19.859	3	2
4	CPU-INT-I7-13700K	intel-core-i7-13700k	Intel Core i7-13700K	Processeur 16 cœurs LGA1700 débloqué, pour les configurations haut de gamme.	Unlocked 16-core LGA1700 processor for high-end builds.	1590.000	6	t	2026-11-03 21:19:19.863	2026-11-03 21:19:19.863	3	2
5	MB-ASUS-B650-TUF	asus-tuf-gaming-b650-plus-wifi	ASUS TUF Gaming B650-Plus WiFi	Carte mère ATX AM5 DDR5 avec WiFi, robuste et complète.	ATX AM5 DDR5 motherboard with WiFi, sturdy and well-equipped.	890.000	8	t	2026-11-03 21:19:19.867	2026-11-03 21:19:19.867	4	3
6	MB-GIG-B650M-DS3H	gigabyte-b650m-ds3h	Gigabyte B650M DS3H	Carte mère micro-ATX AM5 DDR5 abordable, parfaite pour un PC compact.	Affordable micro-ATX AM5 DDR5 motherboard, great for a compact PC.	620.000	12	t	2026-11-03 21:19:19.877	2026-11-03 21:19:19.877	4	4
7	MB-MSI-B760M-P-D4	msi-pro-b760m-p-ddr4	MSI PRO B760M-P DDR4	Carte mère micro-ATX LGA1700 DDR4, idéale pour les petits budgets.	Micro-ATX LGA1700 DDR4 motherboard, ideal for tight budgets.	439.000	14	t	2026-11-03 21:19:19.882	2026-11-03 21:19:19.882	4	5
8	MB-ASUS-Z790-P	asus-prime-z790-p-wifi	ASUS Prime Z790-P WiFi	Carte mère ATX LGA1700 DDR5 avec WiFi, compatible overclocking.	ATX LGA1700 DDR5 motherboard with WiFi, overclocking-ready.	1049.000	5	t	2026-11-03 21:19:19.886	2026-11-03 21:19:19.886	4	3
9	RAM-COR-LPX-16-3200	corsair-vengeance-lpx-16go-ddr4-3200	Corsair Vengeance LPX 16 Go (2x8) DDR4-3200	Kit mémoire DDR4 16 Go (2 x 8 Go) à 3200 MHz.	16 GB (2 x 8 GB) DDR4 memory kit at 3200 MHz.	139.000	30	t	2026-11-03 21:19:19.891	2026-11-03 21:19:19.891	5	6
10	RAM-KIN-FB-32-3200	kingston-fury-beast-32go-ddr4-3200	Kingston FURY Beast 32 Go (2x16) DDR4-3200	Kit mémoire DDR4 32 Go (2 x 16 Go) à 3200 MHz.	32 GB (2 x 16 GB) DDR4 memory kit at 3200 MHz.	249.000	18	t	2026-11-03 21:19:19.899	2026-11-03 21:19:19.899	5	7
11	RAM-COR-VEN-32-5600	corsair-vengeance-32go-ddr5-5600	Corsair Vengeance 32 Go (2x16) DDR5-5600	Kit mémoire DDR5 32 Go (2 x 16 Go) à 5600 MHz.	32 GB (2 x 16 GB) DDR5 memory kit at 5600 MHz.	420.000	16	t	2026-11-03 21:19:19.904	2026-11-03 21:19:19.904	5	6
12	RAM-GSK-TZ5-32-6000	gskill-trident-z5-rgb-32go-ddr5-6000	G.Skill Trident Z5 RGB 32 Go (2x16) DDR5-6000	Kit mémoire DDR5 32 Go rapide avec éclairage RGB, 6000 MHz.	Fast 32 GB DDR5 kit with RGB lighting, 6000 MHz.	539.000	9	t	2026-11-03 21:19:19.908	2026-11-03 21:19:19.908	5	8
13	GPU-ASUS-RTX4060-DUAL	asus-dual-geforce-rtx-4060-oc-8go	ASUS Dual GeForce RTX 4060 OC 8 Go	Carte graphique NVIDIA pour jouer en 1080p avec une faible consommation.	NVIDIA graphics card for 1080p gaming with low power consumption.	1349.000	10	t	2026-11-03 21:19:19.912	2026-11-03 21:19:19.912	6	3
14	GPU-SAP-RX7600-PULSE	sapphire-pulse-radeon-rx-7600-8go	Sapphire Pulse Radeon RX 7600 8 Go	Carte graphique AMD efficace pour le jeu en 1080p.	Efficient AMD graphics card for 1080p gaming.	1099.000	7	t	2026-11-03 21:19:19.917	2026-11-03 21:19:19.917	6	9
15	GPU-MSI-RTX4070S-V2X	msi-geforce-rtx-4070-super-12g-ventus-2x	MSI GeForce RTX 4070 SUPER 12G Ventus 2X	Carte graphique NVIDIA haut de gamme pour le jeu en 1440p.	High-end NVIDIA graphics card for 1440p gaming.	2790.000	4	t	2026-11-03 21:19:19.922	2026-11-03 21:19:19.922	6	5
16	PSU-COR-CX550	corsair-cx550	Corsair CX550	Alimentation 550 W certifiée 80 Plus Bronze, pour les configurations simples.	550 W 80 Plus Bronze power supply for simple builds.	199.000	20	t	2026-11-03 21:19:19.926	2026-11-03 21:19:19.926	7	6
17	PSU-MSI-A650BN	msi-mag-a650bn	MSI MAG A650BN	Alimentation 650 W certifiée 80 Plus Bronze, fiable et économique.	Reliable and affordable 650 W 80 Plus Bronze power supply.	229.000	17	t	2026-11-03 21:19:19.933	2026-11-03 21:19:19.933	7	5
18	PSU-COR-RM750E	corsair-rm750e	Corsair RM750e	Alimentation 750 W 80 Plus Gold entièrement modulaire.	Fully modular 750 W 80 Plus Gold power supply.	419.000	8	t	2026-11-03 21:19:19.937	2026-11-03 21:19:19.937	7	6
19	CASE-NZXT-H5FLOW	nzxt-h5-flow	NZXT H5 Flow	Boîtier moyen format ATX avec un excellent flux d’air.	Mid-tower ATX case with excellent airflow.	369.000	6	t	2026-11-03 21:19:19.941	2026-11-03 21:19:19.941	8	10
20	CASE-COR-4000D	corsair-4000d-airflow	Corsair 4000D Airflow	Boîtier moyen format ATX, montage facile et bonne ventilation.	Mid-tower ATX case with easy building and good cooling.	349.000	9	t	2026-11-03 21:19:19.948	2026-11-03 21:19:19.948	8	6
21	CASE-CM-Q300L	cooler-master-masterbox-q300l	Cooler Master MasterBox Q300L	Boîtier compact micro-ATX, économique et pratique.	Compact and affordable micro-ATX case.	169.000	11	t	2026-11-03 21:19:19.952	2026-11-03 21:19:19.952	8	11
22	PER-LOG-G102	logitech-g102-lightsync	Logitech G102 Lightsync	Souris gaming filaire avec capteur 8000 DPI et éclairage RGB.	Wired gaming mouse with 8000 DPI sensor and RGB lighting.	69.000	40	t	2026-11-03 21:19:19.959	2026-11-03 21:19:19.959	9	12
23	PER-RED-K552	redragon-k552-kumara-rgb	Redragon K552 Kumara RGB	Clavier mécanique compact filaire avec rétroéclairage RGB.	Compact wired mechanical keyboard with RGB backlight.	129.000	25	t	2026-11-03 21:19:19.966	2026-11-03 21:19:19.966	10	13
24	PER-AOC-24G2SP	aoc-24g2sp-165hz	AOC 24G2SP 24" 165 Hz	Écran gaming IPS 23,8 pouces Full HD, 165 Hz et 1 ms.	23.8-inch Full HD IPS gaming monitor, 165 Hz and 1 ms.	549.000	10	t	2026-11-03 21:19:19.97	2026-11-03 21:19:19.97	11	14
\.


--
-- Data for Name: ProductImage; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ProductImage" (id, url, "altText", "position", "isPrimary", "productId") FROM stdin;
\.


--
-- Data for Name: ProductSpec; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ProductSpec" (id, name, "valueText", "valueNumber", unit, "productId") FROM stdin;
1	Connectique	Filaire (USB)	\N	\N	22
2	Résolution maximale	8000 DPI	8000.000	DPI	22
3	Boutons	6	6.000	\N	22
4	Rétroéclairage	RGB	\N	\N	22
5	Format	TKL (87 touches)	87.000	touches	23
6	Switches	Outemu Blue	\N	\N	23
7	Connectique	Filaire (USB)	\N	\N	23
8	Rétroéclairage	RGB	\N	\N	23
9	Diagonale	23,8 pouces	23.800	pouces	24
10	Résolution	1920 x 1080	\N	\N	24
11	Fréquence	165 Hz	165.000	Hz	24
12	Type de dalle	IPS	\N	\N	24
13	Temps de réponse	1 ms	1.000	ms	24
\.


--
-- Data for Name: Ram; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Ram" ("productId", type, "capacityGB", modules, "speedMHz") FROM stdin;
9	DDR4	16	2	3200
10	DDR4	32	2	3200
11	DDR5	32	2	5600
12	DDR5	32	2	6000
\.


--
-- Data for Name: StockMovement; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."StockMovement" (id, "quantityChange", reason, note, "createdAt", "productId", "performedById") FROM stdin;
1	15	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.843	1	\N
2	10	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.854	2	\N
3	20	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.859	3	\N
4	6	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.863	4	\N
5	8	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.867	5	\N
6	12	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.877	6	\N
7	14	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.882	7	\N
8	5	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.886	8	\N
9	30	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.891	9	\N
10	18	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.899	10	\N
11	16	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.904	11	\N
12	9	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.908	12	\N
13	10	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.912	13	\N
14	7	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.917	14	\N
15	4	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.922	15	\N
16	20	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.926	16	\N
17	17	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.933	17	\N
18	8	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.937	18	\N
19	6	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.941	19	\N
20	9	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.948	20	\N
21	11	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.952	21	\N
22	40	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.959	22	\N
23	25	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.966	23	\N
24	10	RESTOCK	Stock initial (données de test)	2026-11-03 21:19:19.97	24	\N
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, email, "passwordHash", "firstName", "lastName", phone, role, language, "createdAt") FROM stdin;
1	test@bytebazaar.tn	78f34b5805ee5a354af8aefacc41b4f3:790b5c6ab6b1970bde5639c47110ddacf31416f287ef7100ad01f9efa4c170514082b5dc087bfc563702f3bb7693317a91629cebab3fe1593c6af7d8602eaa9e	Test	User	\N	CUSTOMER	FR	2026-11-03 22:51:52.883
2	name@gmail.com	5877b2880bd63fd6180c89ab8f060010:ffe1304304c49bb5877fd0c07ae3e4b556e5b453f14963497805ac36999a90925f7a702e019c83cc2d77cb57650737fc2aa15452e27be7e1a9d962c75c0b1128	surname	name	123456578	CUSTOMER	FR	2026-11-03 23:00:57.892
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
e8b8486a-5e34-48e9-ae78-25e376304ce6	713456bfcd124f64af7327e7e958df296fb08022afeeeb54477a27eac0fe1289	2026-11-03 22:09:36.155008+01	20261103210936_init	\N	\N	2026-11-03 22:09:36.013125+01	1
\.


--
-- Name: Address_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Address_id_seq"', 4, true);


--
-- Name: Brand_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Brand_id_seq"', 14, true);


--
-- Name: CartItem_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."CartItem_id_seq"', 4, true);


--
-- Name: Cart_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Cart_id_seq"', 1, true);


--
-- Name: Category_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Category_id_seq"', 11, true);


--
-- Name: ConfigurationItem_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."ConfigurationItem_id_seq"', 1, false);


--
-- Name: Configuration_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Configuration_id_seq"', 1, false);


--
-- Name: OrderItem_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."OrderItem_id_seq"', 1, false);


--
-- Name: Order_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Order_id_seq"', 1, false);


--
-- Name: ProductImage_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."ProductImage_id_seq"', 1, false);


--
-- Name: ProductSpec_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."ProductSpec_id_seq"', 13, true);


--
-- Name: Product_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Product_id_seq"', 24, true);


--
-- Name: StockMovement_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."StockMovement_id_seq"', 24, true);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."User_id_seq"', 2, true);


--
-- Name: Address Address_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Address"
    ADD CONSTRAINT "Address_pkey" PRIMARY KEY (id);


--
-- Name: Brand Brand_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Brand"
    ADD CONSTRAINT "Brand_pkey" PRIMARY KEY (id);


--
-- Name: CartItem CartItem_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CartItem"
    ADD CONSTRAINT "CartItem_pkey" PRIMARY KEY (id);


--
-- Name: Cart Cart_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Cart"
    ADD CONSTRAINT "Cart_pkey" PRIMARY KEY (id);


--
-- Name: Category Category_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY (id);


--
-- Name: ConfigurationItem ConfigurationItem_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ConfigurationItem"
    ADD CONSTRAINT "ConfigurationItem_pkey" PRIMARY KEY (id);


--
-- Name: Configuration Configuration_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Configuration"
    ADD CONSTRAINT "Configuration_pkey" PRIMARY KEY (id);


--
-- Name: Cpu Cpu_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Cpu"
    ADD CONSTRAINT "Cpu_pkey" PRIMARY KEY ("productId");


--
-- Name: Gpu Gpu_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Gpu"
    ADD CONSTRAINT "Gpu_pkey" PRIMARY KEY ("productId");


--
-- Name: Motherboard Motherboard_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Motherboard"
    ADD CONSTRAINT "Motherboard_pkey" PRIMARY KEY ("productId");


--
-- Name: OrderItem OrderItem_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_pkey" PRIMARY KEY (id);


--
-- Name: Order Order_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY (id);


--
-- Name: PcCase PcCase_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PcCase"
    ADD CONSTRAINT "PcCase_pkey" PRIMARY KEY ("productId");


--
-- Name: PowerSupply PowerSupply_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PowerSupply"
    ADD CONSTRAINT "PowerSupply_pkey" PRIMARY KEY ("productId");


--
-- Name: ProductImage ProductImage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ProductImage"
    ADD CONSTRAINT "ProductImage_pkey" PRIMARY KEY (id);


--
-- Name: ProductSpec ProductSpec_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ProductSpec"
    ADD CONSTRAINT "ProductSpec_pkey" PRIMARY KEY (id);


--
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);


--
-- Name: Ram Ram_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Ram"
    ADD CONSTRAINT "Ram_pkey" PRIMARY KEY ("productId");


--
-- Name: StockMovement StockMovement_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."StockMovement"
    ADD CONSTRAINT "StockMovement_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Address_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Address_userId_idx" ON public."Address" USING btree ("userId");


--
-- Name: Brand_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Brand_name_key" ON public."Brand" USING btree (name);


--
-- Name: Brand_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Brand_slug_key" ON public."Brand" USING btree (slug);


--
-- Name: CartItem_cartId_productId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "CartItem_cartId_productId_key" ON public."CartItem" USING btree ("cartId", "productId");


--
-- Name: CartItem_productId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "CartItem_productId_idx" ON public."CartItem" USING btree ("productId");


--
-- Name: Cart_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Cart_userId_key" ON public."Cart" USING btree ("userId");


--
-- Name: Category_parentId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Category_parentId_idx" ON public."Category" USING btree ("parentId");


--
-- Name: Category_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Category_slug_key" ON public."Category" USING btree (slug);


--
-- Name: ConfigurationItem_configurationId_productId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ConfigurationItem_configurationId_productId_key" ON public."ConfigurationItem" USING btree ("configurationId", "productId");


--
-- Name: ConfigurationItem_productId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ConfigurationItem_productId_idx" ON public."ConfigurationItem" USING btree ("productId");


--
-- Name: Configuration_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Configuration_userId_idx" ON public."Configuration" USING btree ("userId");


--
-- Name: Cpu_socket_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Cpu_socket_idx" ON public."Cpu" USING btree (socket);


--
-- Name: Motherboard_socket_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Motherboard_socket_idx" ON public."Motherboard" USING btree (socket);


--
-- Name: OrderItem_orderId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "OrderItem_orderId_idx" ON public."OrderItem" USING btree ("orderId");


--
-- Name: OrderItem_productId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "OrderItem_productId_idx" ON public."OrderItem" USING btree ("productId");


--
-- Name: Order_reference_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Order_reference_key" ON public."Order" USING btree (reference);


--
-- Name: Order_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Order_status_idx" ON public."Order" USING btree (status);


--
-- Name: Order_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Order_userId_idx" ON public."Order" USING btree ("userId");


--
-- Name: ProductImage_productId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ProductImage_productId_idx" ON public."ProductImage" USING btree ("productId");


--
-- Name: ProductSpec_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ProductSpec_name_idx" ON public."ProductSpec" USING btree (name);


--
-- Name: ProductSpec_productId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ProductSpec_productId_idx" ON public."ProductSpec" USING btree ("productId");


--
-- Name: Product_brandId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Product_brandId_idx" ON public."Product" USING btree ("brandId");


--
-- Name: Product_categoryId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Product_categoryId_idx" ON public."Product" USING btree ("categoryId");


--
-- Name: Product_isActive_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Product_isActive_idx" ON public."Product" USING btree ("isActive");


--
-- Name: Product_sku_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Product_sku_key" ON public."Product" USING btree (sku);


--
-- Name: Product_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Product_slug_key" ON public."Product" USING btree (slug);


--
-- Name: StockMovement_performedById_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "StockMovement_performedById_idx" ON public."StockMovement" USING btree ("performedById");


--
-- Name: StockMovement_productId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "StockMovement_productId_idx" ON public."StockMovement" USING btree ("productId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: Address Address_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Address"
    ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CartItem CartItem_cartId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CartItem"
    ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES public."Cart"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CartItem CartItem_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CartItem"
    ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Cart Cart_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Cart"
    ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Category Category_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ConfigurationItem ConfigurationItem_configurationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ConfigurationItem"
    ADD CONSTRAINT "ConfigurationItem_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES public."Configuration"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ConfigurationItem ConfigurationItem_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ConfigurationItem"
    ADD CONSTRAINT "ConfigurationItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Configuration Configuration_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Configuration"
    ADD CONSTRAINT "Configuration_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Cpu Cpu_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Cpu"
    ADD CONSTRAINT "Cpu_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Gpu Gpu_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Gpu"
    ADD CONSTRAINT "Gpu_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Motherboard Motherboard_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Motherboard"
    ADD CONSTRAINT "Motherboard_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderItem OrderItem_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderItem OrderItem_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Order Order_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PcCase PcCase_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PcCase"
    ADD CONSTRAINT "PcCase_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PowerSupply PowerSupply_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PowerSupply"
    ADD CONSTRAINT "PowerSupply_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProductImage ProductImage_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ProductImage"
    ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProductSpec ProductSpec_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ProductSpec"
    ADD CONSTRAINT "ProductSpec_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Product Product_brandId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES public."Brand"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Product Product_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Ram Ram_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Ram"
    ADD CONSTRAINT "Ram_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StockMovement StockMovement_performedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."StockMovement"
    ADD CONSTRAINT "StockMovement_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: StockMovement StockMovement_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."StockMovement"
    ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict ReNoeGV8smvUu5jaxXnCll198eFj8AbDEdoyjzdrSc7iZeEGiimVcNiqBhXGMLg

