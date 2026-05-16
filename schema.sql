--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

-- Started on 2026-05-16 19:00:08

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 220 (class 1259 OID 18325)
-- Name: courses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.courses (
    id integer NOT NULL,
    author_id integer NOT NULL,
    title character varying(255) NOT NULL,
    short_description text DEFAULT ''::text NOT NULL,
    intro_content text DEFAULT ''::text NOT NULL,
    cover_image_url text DEFAULT ''::text NOT NULL,
    tags_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.courses OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 18324)
-- Name: courses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.courses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.courses_id_seq OWNER TO postgres;

--
-- TOC entry 4911 (class 0 OID 0)
-- Dependencies: 219
-- Name: courses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.courses_id_seq OWNED BY public.courses.id;


--
-- TOC entry 232 (class 1259 OID 18455)
-- Name: enrollments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.enrollments (
    id integer NOT NULL,
    student_id integer NOT NULL,
    course_id integer NOT NULL,
    enrolled_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.enrollments OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 18454)
-- Name: enrollments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.enrollments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.enrollments_id_seq OWNER TO postgres;

--
-- TOC entry 4912 (class 0 OID 0)
-- Dependencies: 231
-- Name: enrollments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.enrollments_id_seq OWNED BY public.enrollments.id;


--
-- TOC entry 224 (class 1259 OID 18359)
-- Name: lesson_blocks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lesson_blocks (
    id integer NOT NULL,
    lesson_id integer NOT NULL,
    type character varying(20) NOT NULL,
    title character varying(255) NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    quiz_data jsonb DEFAULT '{}'::jsonb,
    attachment_url text DEFAULT ''::text NOT NULL,
    "position" integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT lesson_blocks_type_check CHECK (((type)::text = ANY ((ARRAY['lecture'::character varying, 'practice'::character varying, 'test'::character varying])::text[])))
);


ALTER TABLE public.lesson_blocks OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 18358)
-- Name: lesson_blocks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lesson_blocks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lesson_blocks_id_seq OWNER TO postgres;

--
-- TOC entry 4913 (class 0 OID 0)
-- Dependencies: 223
-- Name: lesson_blocks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lesson_blocks_id_seq OWNED BY public.lesson_blocks.id;


--
-- TOC entry 222 (class 1259 OID 18345)
-- Name: lessons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lessons (
    id integer NOT NULL,
    course_id integer NOT NULL,
    title character varying(255) NOT NULL,
    "position" integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.lessons OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 18344)
-- Name: lessons_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lessons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lessons_id_seq OWNER TO postgres;

--
-- TOC entry 4914 (class 0 OID 0)
-- Dependencies: 221
-- Name: lessons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lessons_id_seq OWNED BY public.lessons.id;


--
-- TOC entry 226 (class 1259 OID 18379)
-- Name: submissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.submissions (
    id integer NOT NULL,
    student_id integer NOT NULL,
    block_id integer NOT NULL,
    code text NOT NULL,
    language character varying(40) DEFAULT 'javascript'::character varying NOT NULL,
    status character varying(40) DEFAULT 'submitted'::character varying NOT NULL,
    result_message text DEFAULT ''::text NOT NULL,
    tests_result jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.submissions OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 18378)
-- Name: submissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.submissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.submissions_id_seq OWNER TO postgres;

--
-- TOC entry 4915 (class 0 OID 0)
-- Dependencies: 225
-- Name: submissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.submissions_id_seq OWNED BY public.submissions.id;


--
-- TOC entry 228 (class 1259 OID 18403)
-- Name: user_course_progress; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_course_progress (
    id integer NOT NULL,
    user_id integer NOT NULL,
    course_id integer NOT NULL,
    lesson_id integer NOT NULL,
    block_id integer NOT NULL,
    completed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.user_course_progress OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 18402)
-- Name: user_course_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_course_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_course_progress_id_seq OWNER TO postgres;

--
-- TOC entry 4916 (class 0 OID 0)
-- Dependencies: 227
-- Name: user_course_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_course_progress_id_seq OWNED BY public.user_course_progress.id;


--
-- TOC entry 230 (class 1259 OID 18433)
-- Name: user_quiz_attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_quiz_attempts (
    id integer NOT NULL,
    user_id integer NOT NULL,
    block_id integer NOT NULL,
    answers jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_correct boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.user_quiz_attempts OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 18432)
-- Name: user_quiz_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_quiz_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_quiz_attempts_id_seq OWNER TO postgres;

--
-- TOC entry 4917 (class 0 OID 0)
-- Dependencies: 229
-- Name: user_quiz_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_quiz_attempts_id_seq OWNED BY public.user_quiz_attempts.id;


--
-- TOC entry 218 (class 1259 OID 18312)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(120) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    llm_api_key_encrypted text,
    llm_folder_id text,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['student'::character varying, 'author'::character varying, 'admin'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 217 (class 1259 OID 18311)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 4918 (class 0 OID 0)
-- Dependencies: 217
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 4678 (class 2604 OID 18328)
-- Name: courses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.courses ALTER COLUMN id SET DEFAULT nextval('public.courses_id_seq'::regclass);


--
-- TOC entry 4706 (class 2604 OID 18458)
-- Name: enrollments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrollments ALTER COLUMN id SET DEFAULT nextval('public.enrollments_id_seq'::regclass);


--
-- TOC entry 4688 (class 2604 OID 18362)
-- Name: lesson_blocks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lesson_blocks ALTER COLUMN id SET DEFAULT nextval('public.lesson_blocks_id_seq'::regclass);


--
-- TOC entry 4685 (class 2604 OID 18348)
-- Name: lessons id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lessons ALTER COLUMN id SET DEFAULT nextval('public.lessons_id_seq'::regclass);


--
-- TOC entry 4694 (class 2604 OID 18382)
-- Name: submissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissions ALTER COLUMN id SET DEFAULT nextval('public.submissions_id_seq'::regclass);


--
-- TOC entry 4700 (class 2604 OID 18406)
-- Name: user_course_progress id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_course_progress ALTER COLUMN id SET DEFAULT nextval('public.user_course_progress_id_seq'::regclass);


--
-- TOC entry 4702 (class 2604 OID 18436)
-- Name: user_quiz_attempts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_quiz_attempts ALTER COLUMN id SET DEFAULT nextval('public.user_quiz_attempts_id_seq'::regclass);


--
-- TOC entry 4676 (class 2604 OID 18315)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 4893 (class 0 OID 18325)
-- Dependencies: 220
-- Data for Name: courses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.courses (id, author_id, title, short_description, intro_content, cover_image_url, tags_json, is_published, created_at) FROM stdin;
2	1	1242	123	321	123	["123"]	t	2026-05-10 16:22:01.382536
3	1	123	123	123	123	["123"]	t	2026-05-10 17:01:07.115981
1	1	JavaScript1	Изучение основ и продвинутых возможностей JavaScript для начинающих и тех, кто хочет углубить свои знания.	Наш курс по JavaScript предназначен для тех, кто хочет освоить один из самых популярных языков программирования в мире. Мы предлагаем комплексное изучение языка, начиная с основ и заканчивая продвинутыми возможностями.\n\nЧто вы узнаете:\n\n- основы синтаксиса JavaScript;\n- работу с переменными и операторами;\n- основные типы данных;\n- принципы работы с функциями;\n- особенности объектно-ориентированного программирования;\n- как работать с DOM и AJAX;\n- приёмы асинхронного программирования.\n\nКурс подойдёт как для начинающих, так и для тех, кто хочет углубить свои знания и улучшить навыки работы с JavaScript.	https://i.ytimg.com/vi/PPru4M40IIY/maxresdefault.jpg	["Javascript", "Программирование", "SyntaxJS", "DOM", "AJAX", "ООП", "asyncJS", "LearnJavaScript", "BeginnerJS", "AdvancedJS"]	t	2026-05-07 13:23:43.620665
4	1	12315	1231	123	12315	["123521"]	t	2026-05-10 17:01:16.128166
\.


--
-- TOC entry 4905 (class 0 OID 18455)
-- Dependencies: 232
-- Data for Name: enrollments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.enrollments (id, student_id, course_id, enrolled_at) FROM stdin;
1	2	1	2026-05-07 14:05:02.633286
17	2	4	2026-05-10 18:05:28.501072
\.


--
-- TOC entry 4897 (class 0 OID 18359)
-- Dependencies: 224
-- Data for Name: lesson_blocks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lesson_blocks (id, lesson_id, type, title, content, quiz_data, attachment_url, "position", created_at) FROM stdin;
1	1	lecture	Привет	Добро пожаловать на наш курс! Сегодня мы начнём с простого, но важного шага — знакомства. В этой лекции мы поговорим о том, почему знакомство важно, и как оно помогает в общении.\n\nО себе\nДавайте я расскажу немного о себе. Меня можно представить следующим образом:\n\nИмя: [Имя]\nПрофессия: [Профессия]\nОпыт: [Описание опыта работы или обучения]\nИнтересы: [Перечислить интересы]\nВажность знакомства\nЗнакомство — это первый шаг к установлению контакта с другим человеком. Оно помогает:\n\nПонять, кто перед вами.\nОпределить общие интересы и темы для общения.\nСоздать атмосферу доверия и открытости.\nВ процессе знакомства мы получаем информацию о другом человеке, его характере, интересах и взглядах на жизнь. Это помогает нам лучше понимать друг друга и находить общий язык.\n\nЗаключение\nЗнакомство — это не просто формальность, а важный этап в общении. Оно помогает установить контакт и создать основу для дальнейшего взаимодействия. В следующих уроках мы рассмотрим более сложные аспекты общения и взаимодействия	{"options": [], "quiz_type": "single"}		3	2026-05-07 13:24:08.343317
11	29	lecture	1		{"options": [], "quiz_type": "single"}	1	3	2026-05-14 14:19:47.709473
5	1	practice	Тестирование кода	Напишите функцию, которая сложит 3 числа	{"options": [], "quiz_type": "single", "task_type": "code", "test_cases": [{"input": "1 2 3", "is_hidden": false, "expected_output": "6"}, {"input": "2 3 3", "is_hidden": false, "expected_output": "8"}, {"input": "1 2 2", "is_hidden": false, "expected_output": "2"}], "function_name": "sum", "placeholder_code": "function sum(x,y,z) {\\n}"}		1	2026-05-08 13:22:19.674633
4	1	test	Прикол		{"options": [{"hint": "не крут ваще", "text": "Неправильно", "is_correct": false}, {"hint": "ты круть", "text": "Правильно", "is_correct": true}, {"hint": "ты круть 2", "text": "Правильно", "is_correct": true}], "quiz_type": "multiple"}	https://pic.rtbcdn.ru/video/2026-02-20/2b/5f/2b5fbd5fa38ce987abb43c604333edbe.jpg	2	2026-05-07 13:51:22.902262
6	2	lecture	Лекция		{"options": [], "quiz_type": "single"}		1	2026-05-10 18:05:45.824466
7	2	practice	Проверка кода		{"options": [], "quiz_type": "single"}		2	2026-05-10 18:05:52.224222
9	29	lecture	123		{"options": [], "quiz_type": "single"}	123	1	2026-05-10 20:14:29.264707
10	29	practice	123		{"options": [], "quiz_type": "single", "task_type": "code", "test_cases": [{"input": "12 4", "is_hidden": false, "expected_output": "8"}], "function_name": "", "placeholder_code": "function del(x,y){\\r\\n  l = x-y;\\r\\n  console.log(l);\\r\\n}"}		2	2026-05-10 20:16:51.980987
\.


--
-- TOC entry 4895 (class 0 OID 18345)
-- Dependencies: 222
-- Data for Name: lessons; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lessons (id, course_id, title, "position", created_at) FROM stdin;
7	2	Урок.	1	2026-05-10 16:22:05.857589
8	2	Новый урок.	1	2026-05-10 16:22:08.002232
2	1	Всем привет.	2	2026-05-10 16:05:49.52593
3	1	Ещё.	3	2026-05-10 16:06:19.947054
9	1	123	4	2026-05-10 16:29:57.772999
6	1	Новый урок.	5	2026-05-10 16:21:50.425847
4	1	123	6	2026-05-10 16:21:42.72417
5	1	213	7	2026-05-10 16:21:43.833208
10	1	123	8	2026-05-10 16:29:59.022213
12	1	123	9	2026-05-10 16:30:01.444034
11	1	123	10	2026-05-10 16:29:59.901342
13	1	123	11	2026-05-10 16:39:57.69985
14	1	142	12	2026-05-10 16:39:58.793092
15	1	2	13	2026-05-10 16:39:59.665816
16	1	2	14	2026-05-10 16:40:00.279864
17	1	2	15	2026-05-10 16:40:01.13677
18	1	1	16	2026-05-10 16:40:02.282894
19	1	23	17	2026-05-10 16:40:03.059532
20	1	32131	18	2026-05-10 16:40:04.443504
21	1	123	19	2026-05-10 16:41:11.99294
22	1	123	20	2026-05-10 16:41:12.83058
23	1	123	21	2026-05-10 16:41:14.144286
24	1	123	22	2026-05-10 16:41:15.404931
25	1	123	23	2026-05-10 16:41:16.326303
26	1	213	24	2026-05-10 16:41:17.83717
1	1	Знакомство	1	2026-05-07 13:23:54.317843
30	4	32	2	2026-05-10 20:14:24.966633
29	4	123	1	2026-05-10 20:14:23.066751
\.


--
-- TOC entry 4899 (class 0 OID 18379)
-- Dependencies: 226
-- Data for Name: submissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.submissions (id, student_id, block_id, code, language, status, result_message, tests_result, created_at) FROM stdin;
3	2	5	console.log(6)	javascript	failed	1 out of 2 tests failed.	{"total": 2, "failed": 1, "passed": 1, "details": [{"input": "1 2 3", "actual": "6", "passed": true, "expected": "6", "exit_code": 0, "is_hidden": false}, {"input": "2 3 3", "actual": "6", "passed": false, "expected": "8", "exit_code": 0, "is_hidden": false}]}	2026-05-08 13:24:26.179126
4	2	5	function sum(x,y,z){\nreturn (x+y+z)\n}	javascript	failed	2 out of 2 tests failed.	{"total": 2, "failed": 2, "passed": 0, "details": [{"input": "1 2 3", "actual": "", "passed": false, "expected": "6", "exit_code": 0, "is_hidden": false}, {"input": "2 3 3", "actual": "", "passed": false, "expected": "8", "exit_code": 0, "is_hidden": false}]}	2026-05-08 13:25:54.802893
5	2	5	function sum(x,y,z){\nsum = x+y+z;\nreturn sum\n}	javascript	failed	2 out of 2 tests failed.	{"total": 2, "failed": 2, "passed": 0, "details": [{"input": "1 2 3", "actual": "", "passed": false, "expected": "6", "exit_code": 0, "is_hidden": false}, {"input": "2 3 3", "actual": "", "passed": false, "expected": "8", "exit_code": 0, "is_hidden": false}]}	2026-05-08 13:26:12.499606
6	2	5	function sum(x, y, z) {\n  sum = x + y + z;\n  return sum;\n}	javascript	failed	2 out of 2 tests failed.	{"total": 2, "failed": 2, "passed": 0, "details": [{"input": "1 2 3", "actual": "", "passed": false, "expected": "6", "exit_code": 0, "is_hidden": false}, {"input": "2 3 3", "actual": "", "passed": false, "expected": "8", "exit_code": 0, "is_hidden": false}]}	2026-05-08 13:26:39.010621
7	2	5	function sum(x, y, z) {\n  sum = x + y + z;\n  console.log(sum);\n}	javascript	failed	2 out of 2 tests failed.	{"total": 2, "failed": 2, "passed": 0, "details": [{"input": "1 2 3", "actual": "", "passed": false, "expected": "6", "exit_code": 0, "is_hidden": false}, {"input": "2 3 3", "actual": "", "passed": false, "expected": "8", "exit_code": 0, "is_hidden": false}]}	2026-05-08 13:26:52.756287
8	2	5	function sum(x,y,z){\nreturn sum\n}	javascript	failed	2 out of 2 tests failed.	{"total": 2, "failed": 2, "passed": 0, "details": [{"input": "1 2 3", "actual": "", "passed": false, "expected": "6", "exit_code": 0, "is_hidden": false}, {"input": "2 3 3", "actual": "", "passed": false, "expected": "8", "exit_code": 0, "is_hidden": false}]}	2026-05-08 14:23:22.129317
9	2	5	function sum(x,y,z){\nreturn (x+y+z)\n}	javascript	failed	2 out of 2 tests failed.	{"total": 2, "failed": 2, "passed": 0, "details": [{"input": "1 2 3", "actual": "", "passed": false, "expected": "6", "exit_code": 0, "is_hidden": false}, {"input": "2 3 3", "actual": "", "passed": false, "expected": "8", "exit_code": 0, "is_hidden": false}]}	2026-05-08 14:23:31.746581
10	2	5	function sum(x,y,z){\nsum = x+y+z;\nreturn sum\n}	javascript	failed	2 out of 2 tests failed.	{"total": 2, "failed": 2, "passed": 0, "details": [{"input": "1 2 3", "actual": "", "passed": false, "expected": "6", "exit_code": 0, "is_hidden": false}, {"input": "2 3 3", "actual": "", "passed": false, "expected": "8", "exit_code": 0, "is_hidden": false}]}	2026-05-08 14:23:45.049576
11	2	5	function sum(x,y,z){\nsum = x+y+z;\nconsole.log(sum)\n}	javascript	failed	2 out of 2 tests failed.	{"total": 2, "failed": 2, "passed": 0, "details": [{"input": "1 2 3", "actual": "", "passed": false, "expected": "6", "exit_code": 0, "is_hidden": false}, {"input": "2 3 3", "actual": "", "passed": false, "expected": "8", "exit_code": 0, "is_hidden": false}]}	2026-05-08 14:23:54.365296
12	2	5	function sum(x,y,z) {\nm = x+y+z;\nreturn m\n}	javascript	passed	All tests passed successfully!	{"total": 2, "failed": 0, "passed": 2, "details": [{"input": "1 2 3", "actual": "6", "passed": true, "expected": "6", "exit_code": 0, "is_hidden": false}, {"input": "2 3 3", "actual": "8", "passed": true, "expected": "8", "exit_code": 0, "is_hidden": false}]}	2026-05-08 14:26:27.623524
13	2	5	function sum(x,y,z) {\nm = x+y+z;\nconsole.log(m)\n}	javascript	passed	All tests passed successfully!	{"total": 2, "failed": 0, "passed": 2, "details": [{"input": "1 2 3", "actual": "6", "passed": true, "expected": "6", "exit_code": 0, "is_hidden": false}, {"input": "2 3 3", "actual": "8", "passed": true, "expected": "8", "exit_code": 0, "is_hidden": false}]}	2026-05-08 14:26:42.466648
14	2	5	function sum(x,y,z) {\nm = x+y+z;\nconsole.log(m1)\n}	javascript	failed	2 out of 2 tests failed.	{"total": 2, "failed": 2, "passed": 0, "details": [{"input": "1 2 3", "actual": "/box/submission/file0.code:3\\nconsole.log(m1)\\n            ^\\n\\nReferenceError: m1 is not defined\\n    at sum (/box/submission/file0.code:3:13)\\n    at eval (eval at <anonymous> (/box/submission/file0.code:11:18), <anonymous>:1:1)\\n    at Object.<anonymous> (/box/submission/file0.code:11:18)\\n    at Module._compile (node:internal/modules/cjs/loader:1376:14)\\n    at Module._extensions..js (node:internal/modules/cjs/loader:1435:10)\\n    at Module.load (node:internal/modules/cjs/loader:1207:32)\\n    at Module._load (node:internal/modules/cjs/loader:1023:12)\\n    at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:135:12)\\n    at node:internal/main/run_main_module:28:49\\n\\nNode.js v20.11.1", "passed": false, "expected": "6", "exit_code": 1, "is_hidden": false}, {"input": "2 3 3", "actual": "/box/submission/file0.code:3\\nconsole.log(m1)\\n            ^\\n\\nReferenceError: m1 is not defined\\n    at sum (/box/submission/file0.code:3:13)\\n    at eval (eval at <anonymous> (/box/submission/file0.code:11:18), <anonymous>:1:1)\\n    at Object.<anonymous> (/box/submission/file0.code:11:18)\\n    at Module._compile (node:internal/modules/cjs/loader:1376:14)\\n    at Module._extensions..js (node:internal/modules/cjs/loader:1435:10)\\n    at Module.load (node:internal/modules/cjs/loader:1207:32)\\n    at Module._load (node:internal/modules/cjs/loader:1023:12)\\n    at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:135:12)\\n    at node:internal/main/run_main_module:28:49\\n\\nNode.js v20.11.1", "passed": false, "expected": "8", "exit_code": 1, "is_hidden": false}]}	2026-05-08 14:26:44.459519
15	2	7	console.log("Hello World")	javascript	accepted	Solution submitted successfully. No automated tests configured.	{"total": 1, "failed": 0, "passed": 1}	2026-05-10 18:06:12.14796
\.


--
-- TOC entry 4901 (class 0 OID 18403)
-- Dependencies: 228
-- Data for Name: user_course_progress; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_course_progress (id, user_id, course_id, lesson_id, block_id, completed_at) FROM stdin;
2	2	1	1	4	2026-05-07 13:52:35.241203
3	2	1	1	1	2026-05-07 14:05:17.251053
5	2	1	1	5	2026-05-08 14:26:27.625829
7	2	1	2	7	2026-05-10 18:06:12.151869
8	2	1	2	6	2026-05-10 18:06:15.706033
\.


--
-- TOC entry 4903 (class 0 OID 18433)
-- Dependencies: 230
-- Data for Name: user_quiz_attempts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_quiz_attempts (id, user_id, block_id, answers, is_correct, created_at) FROM stdin;
3	2	4	[0]	f	2026-05-07 13:52:29.320679
4	2	4	[0, 2]	f	2026-05-07 13:52:30.785688
5	2	4	[2, 0]	f	2026-05-07 13:52:32.826953
6	2	4	[0, 1]	f	2026-05-07 13:52:33.820697
7	2	4	[1, 2]	t	2026-05-07 13:52:35.240734
\.


--
-- TOC entry 4891 (class 0 OID 18312)
-- Dependencies: 218
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, password_hash, role, created_at, llm_api_key_encrypted, llm_folder_id) FROM stdin;
1	Andrey	andrey.vlasovx@gmail.com	$2b$10$n.A9T97/GSpTC6A7hsJ4t.KLvjTvHZI2z1jwBRUk86zkZDUcKLm7u	author	2026-05-07 13:23:29.929256	v1:KmsUHkRFQcO75M5v:gNoS3MQ/uQjXHw5vMYI1ng==:+IhidYAJ4S2bgPC3X/lK9yF71XKLjk2eJdPiFuWp4l4rrfV4g+IvhA==	b1g8aavaikfdoji0bish
3	Admin	tzifabetssy@hotmail.com	$2b$10$RxWuoCQ2Hl.vSjsWGpUz1.cL2bS21H4apQI/vPs3XW8HZxS0TG6xS	admin	2026-05-12 12:29:11.143061	\N	\N
2	User	foxi8291@gmail.com	$2b$10$FJxmxsGLMwy.00uGkaiBeunuGVOzkEv65IIjWYWlYlzEskfkA8rPW	student	2026-05-07 13:38:28.273111	v1:5w6JBMtQzg4EAhxW:QhjZ6YVoBnaEWN26Kj1GNg==:7MbsptNSppWFUoCtbEBXUaQSJrlWwLIwo81aX8bE+mQbP3oN42n1KQ==	b1g8aavaikfdoji0bish
\.


--
-- TOC entry 4919 (class 0 OID 0)
-- Dependencies: 219
-- Name: courses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.courses_id_seq', 4, true);


--
-- TOC entry 4920 (class 0 OID 0)
-- Dependencies: 231
-- Name: enrollments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.enrollments_id_seq', 19, true);


--
-- TOC entry 4921 (class 0 OID 0)
-- Dependencies: 223
-- Name: lesson_blocks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.lesson_blocks_id_seq', 11, true);


--
-- TOC entry 4922 (class 0 OID 0)
-- Dependencies: 221
-- Name: lessons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.lessons_id_seq', 30, true);


--
-- TOC entry 4923 (class 0 OID 0)
-- Dependencies: 225
-- Name: submissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.submissions_id_seq', 15, true);


--
-- TOC entry 4924 (class 0 OID 0)
-- Dependencies: 227
-- Name: user_course_progress_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_course_progress_id_seq', 8, true);


--
-- TOC entry 4925 (class 0 OID 0)
-- Dependencies: 229
-- Name: user_quiz_attempts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_quiz_attempts_id_seq', 7, true);


--
-- TOC entry 4926 (class 0 OID 0)
-- Dependencies: 217
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 3, true);


--
-- TOC entry 4715 (class 2606 OID 18338)
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- TOC entry 4729 (class 2606 OID 18461)
-- Name: enrollments enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_pkey PRIMARY KEY (id);


--
-- TOC entry 4731 (class 2606 OID 18463)
-- Name: enrollments enrollments_student_id_course_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_student_id_course_id_key UNIQUE (student_id, course_id);


--
-- TOC entry 4719 (class 2606 OID 18372)
-- Name: lesson_blocks lesson_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lesson_blocks
    ADD CONSTRAINT lesson_blocks_pkey PRIMARY KEY (id);


--
-- TOC entry 4717 (class 2606 OID 18352)
-- Name: lessons lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_pkey PRIMARY KEY (id);


--
-- TOC entry 4721 (class 2606 OID 18391)
-- Name: submissions submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_pkey PRIMARY KEY (id);


--
-- TOC entry 4723 (class 2606 OID 18409)
-- Name: user_course_progress user_course_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_course_progress
    ADD CONSTRAINT user_course_progress_pkey PRIMARY KEY (id);


--
-- TOC entry 4725 (class 2606 OID 18411)
-- Name: user_course_progress user_course_progress_user_id_block_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_course_progress
    ADD CONSTRAINT user_course_progress_user_id_block_id_key UNIQUE (user_id, block_id);


--
-- TOC entry 4727 (class 2606 OID 18443)
-- Name: user_quiz_attempts user_quiz_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_quiz_attempts
    ADD CONSTRAINT user_quiz_attempts_pkey PRIMARY KEY (id);


--
-- TOC entry 4711 (class 2606 OID 18323)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4713 (class 2606 OID 18321)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4732 (class 2606 OID 18339)
-- Name: courses courses_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4743 (class 2606 OID 18469)
-- Name: enrollments enrollments_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- TOC entry 4744 (class 2606 OID 18464)
-- Name: enrollments enrollments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4734 (class 2606 OID 18373)
-- Name: lesson_blocks lesson_blocks_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lesson_blocks
    ADD CONSTRAINT lesson_blocks_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) ON DELETE CASCADE;


--
-- TOC entry 4733 (class 2606 OID 18353)
-- Name: lessons lessons_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- TOC entry 4735 (class 2606 OID 18397)
-- Name: submissions submissions_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.lesson_blocks(id) ON DELETE CASCADE;


--
-- TOC entry 4736 (class 2606 OID 18392)
-- Name: submissions submissions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4737 (class 2606 OID 18427)
-- Name: user_course_progress user_course_progress_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_course_progress
    ADD CONSTRAINT user_course_progress_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.lesson_blocks(id) ON DELETE CASCADE;


--
-- TOC entry 4738 (class 2606 OID 18417)
-- Name: user_course_progress user_course_progress_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_course_progress
    ADD CONSTRAINT user_course_progress_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- TOC entry 4739 (class 2606 OID 18422)
-- Name: user_course_progress user_course_progress_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_course_progress
    ADD CONSTRAINT user_course_progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) ON DELETE CASCADE;


--
-- TOC entry 4740 (class 2606 OID 18412)
-- Name: user_course_progress user_course_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_course_progress
    ADD CONSTRAINT user_course_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4741 (class 2606 OID 18449)
-- Name: user_quiz_attempts user_quiz_attempts_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_quiz_attempts
    ADD CONSTRAINT user_quiz_attempts_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.lesson_blocks(id) ON DELETE CASCADE;


--
-- TOC entry 4742 (class 2606 OID 18444)
-- Name: user_quiz_attempts user_quiz_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_quiz_attempts
    ADD CONSTRAINT user_quiz_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- Completed on 2026-05-16 19:00:08

--
-- PostgreSQL database dump complete
--

