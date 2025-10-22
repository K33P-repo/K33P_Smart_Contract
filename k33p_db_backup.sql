--
-- PostgreSQL database dump
--

-- Dumped from database version 14.13 (Ubuntu 14.13-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 14.13 (Ubuntu 14.13-0ubuntu0.22.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tx_hash character varying(128) NOT NULL,
    from_address text NOT NULL,
    to_address text NOT NULL,
    amount bigint NOT NULL,
    confirmations integer DEFAULT 0,
    block_time timestamp with time zone,
    transaction_type character varying(20),
    status character varying(20) DEFAULT 'pending'::character varying,
    user_deposit_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT transactions_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'failed'::character varying])::text[]))),
    CONSTRAINT transactions_transaction_type_check CHECK (((transaction_type)::text = ANY ((ARRAY['deposit'::character varying, 'refund'::character varying, 'signup'::character varying])::text[])))
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: user_deposits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_deposits (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_address text NOT NULL,
    user_id character varying(50) NOT NULL,
    phone_hash character varying(128) NOT NULL,
    zk_proof text,
    zk_commitment text,
    tx_hash character varying(128),
    amount bigint DEFAULT 0 NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    refunded boolean DEFAULT false,
    signup_completed boolean DEFAULT false,
    verified boolean DEFAULT false,
    verification_attempts integer DEFAULT 0,
    last_verification_attempt timestamp with time zone,
    pin_hash character varying(128),
    biometric_hash character varying(128),
    biometric_type character varying(20),
    verification_method character varying(20),
    refund_tx_hash character varying(128),
    refund_timestamp timestamp with time zone,
    sender_wallet_address text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_deposits_biometric_type_check CHECK (((biometric_type)::text = ANY ((ARRAY['fingerprint'::character varying, 'faceid'::character varying, 'voice'::character varying, 'iris'::character varying])::text[]))),
    CONSTRAINT user_deposits_verification_method_check CHECK (((verification_method)::text = ANY ((ARRAY['phone'::character varying, 'pin'::character varying, 'biometric'::character varying])::text[])))
);


ALTER TABLE public.user_deposits OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying(50) NOT NULL,
    email character varying(255),
    name character varying(255),
    username character varying(30),
    wallet_address text,
    phone_hash character varying(128),
    phone_number character varying(20),
    zk_commitment text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    pin character varying(4),
    pin_hash character varying(255),
    verification_method character varying(50) DEFAULT 'phone'::character varying,
    biometric_type character varying(50),
    sender_wallet_address text,
    verified boolean DEFAULT false
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transactions (id, tx_hash, from_address, to_address, amount, confirmations, block_time, transaction_type, status, user_deposit_id, created_at) FROM stdin;
fb088efa-0aff-41bc-a6c2-407037084cab	last_seen_816a68cbbd047f90fe500d6790ca48bb8d3ece4828d6037ac56471da171e309b	auto_refund_monitor_state	last_seen_tx	0	1	\N	refund	confirmed	\N	2025-10-21 09:40:37.068132+01
c3262896-77fd-4de9-a489-50fe260c82e0	last_seen_f2fc48a2f268312efa1f93cb9fd04c2f47aaa4d117bbefea778a5a0713aa3591	auto_refund_monitor_state	last_seen_tx	0	1	\N	refund	confirmed	\N	2025-10-21 10:36:03.521882+01
b3d0a7c8-b853-4f10-800a-cb32c67637b2	processed_f2fc48a2f268312efa1f93cb9fd04c2f47aaa4d117bbefea778a5a0713aa3591	system	system	0	1	\N	refund	confirmed	\N	2025-10-21 10:36:03.553127+01
9476033c-ea14-4fc5-9a95-a461348bbddd	7eae81668ae433dc25b35f317f774a4e288bab59d9c502b58912a38e64d117a4	addr_test1wznyv36t3a2rzfs4q6mvyu7nqlr4dxjwkmykkskafg54yzs735734	addr_test1qzvtgf904gtnulw65y0s3sd5464dndf50uzk3j475r8t9xcj25fjg46ktrern327sg68rqayxkdwftkylvdx7crm7mvqjd4jhf	2000000	0	\N	refund	pending	\N	2025-10-21 10:36:04.885599+01
\.


--
-- Data for Name: user_deposits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_deposits (id, user_address, user_id, phone_hash, zk_proof, zk_commitment, tx_hash, amount, "timestamp", refunded, signup_completed, verified, verification_attempts, last_verification_attempt, pin_hash, biometric_hash, biometric_type, verification_method, refund_tx_hash, refund_timestamp, sender_wallet_address, created_at) FROM stdin;
7db7c6f7-6c40-4dd4-b2ae-605504d84d4e	addr_test1qzvtgf904gtnulw65y0s3sd5464dndf50uzk3j475r8t9xcj25fjg46ktrern327sg68rqayxkdwftkylvdx7crm7mvqjd4jhf	auto_1761039363566			\N	f2fc48a2f268312efa1f93cb9fd04c2f47aaa4d117bbefea778a5a0713aa3591	2000000	2025-10-21 10:36:03.574701+01	t	f	f	0	\N	\N	\N	\N	phone	7eae81668ae433dc25b35f317f774a4e288bab59d9c502b58912a38e64d117a4	2025-10-21 10:36:04.881+01	addr_test1qzvtgf904gtnulw65y0s3sd5464dndf50uzk3j475r8t9xcj25fjg46ktrern327sg68rqayxkdwftkylvdx7crm7mvqjd4jhf	2025-10-21 10:36:03.574701+01
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, user_id, email, name, username, wallet_address, phone_hash, phone_number, zk_commitment, created_at, updated_at, pin, pin_hash, verification_method, biometric_type, sender_wallet_address, verified) FROM stdin;
6fecaf1f-9452-46c4-bfb5-d845980f4004	auto_1761039363566	\N	Auto Refund User	\N	addr_test1qzvtgf904gtnulw65y0s3sd5464dndf50uzk3j475r8t9xcj25fjg46ktrern327sg68rqayxkdwftkylvdx7crm7mvqjd4jhf	\N	\N	\N	2025-10-21 10:36:03.5722+01	2025-10-21 10:36:03.5722+01	\N	\N	phone	\N	\N	f
8dfe2d77-c46a-4089-b6d6-612b2528dcc7	user_test_123	\N	\N	\N	addr_test1qzvtgf904gtnulw65y0s3sd5464dndf50uzk3j475r8t9xcj25fjg46ktrern327sg68rqayxkdwftkylvdx7crm7mvqjd4jhf	14e692b5e95e403c33137793f882bc3b85a73daa186f8dedd25498721fe928dc	+1234567890	880a47d3ebe4737cd694ed3fb9040d55e23de2a8b02382d00a-0bcadf4d	2025-10-21 11:49:16.000137+01	2025-10-21 11:49:16.000137+01	\N	\N	phone	\N	\N	f
\.


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_tx_hash_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_tx_hash_key UNIQUE (tx_hash);


--
-- Name: user_deposits user_deposits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_deposits
    ADD CONSTRAINT user_deposits_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_user_id_key UNIQUE (user_id);


--
-- Name: idx_transactions_tx_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_tx_hash ON public.transactions USING btree (tx_hash);


--
-- Name: idx_user_deposits_tx_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_deposits_tx_hash ON public.user_deposits USING btree (tx_hash);


--
-- Name: idx_user_deposits_user_address; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_deposits_user_address ON public.user_deposits USING btree (user_address);


--
-- Name: idx_user_deposits_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_deposits_user_id ON public.user_deposits USING btree (user_id);


--
-- Name: idx_users_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_user_id ON public.users USING btree (user_id);


--
-- Name: idx_users_wallet_address; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_wallet_address ON public.users USING btree (wallet_address);


--
-- Name: transactions transactions_user_deposit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_deposit_id_fkey FOREIGN KEY (user_deposit_id) REFERENCES public.user_deposits(id) ON DELETE SET NULL;


--
-- Name: user_deposits user_deposits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_deposits
    ADD CONSTRAINT user_deposits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

