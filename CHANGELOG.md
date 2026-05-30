## [1.1.1](https://github.com/AtharvaCM/vehicle-vault/compare/v1.1.0...v1.1.1) (2026-05-30)


### Bug Fixes

* **extraction:** scan multipart, date pre-fill, IN bundled-policy windows ([#39](https://github.com/AtharvaCM/vehicle-vault/issues/39)) ([686190d](https://github.com/AtharvaCM/vehicle-vault/commit/686190d656cb547daabb309368aa21e3e7e67b85)), closes [#31](https://github.com/AtharvaCM/vehicle-vault/issues/31)

# [1.1.0](https://github.com/AtharvaCM/vehicle-vault/compare/v1.0.0...v1.1.0) (2026-05-30)


### Features

* **admin + fuel + forecast:** admin users slice, fuel UX fixes, vehicle-type forecast guards ([#38](https://github.com/AtharvaCM/vehicle-vault/issues/38)) ([a420160](https://github.com/AtharvaCM/vehicle-vault/commit/a42016023f34fc86424a0f722c1bdadf454cb725))

# 1.0.0 (2026-05-30)


### Bug Fixes

* **api:** add missing multer dependency to resolve production crash ([5527135](https://github.com/AtharvaCM/vehicle-vault/commit/552713519046eab8274d91d3617d3baaa8fad6db))
* **api:** align auth and catalog tests with new user model ([5861fa2](https://github.com/AtharvaCM/vehicle-vault/commit/5861fa266c1f93416d72126cb67788f7edaf0aa5))
* **api:** replace any with proper AuthUser type in catalog specs ([476789f](https://github.com/AtharvaCM/vehicle-vault/commit/476789ff4acd14d1b297bd0cda0819b65988796b))
* bundle prisma client in api image ([dce4fcd](https://github.com/AtharvaCM/vehicle-vault/commit/dce4fcd473e5050030bb8ca715c5c82c315ca489))
* **fuel-logs:** parse INR amounts correctly in CSV import ([4912313](https://github.com/AtharvaCM/vehicle-vault/commit/4912313adcfddaabbdb37c09e968224a45df380d))
* resolve frontend and backend build errors (Vercel fix) ([9abc6a0](https://github.com/AtharvaCM/vehicle-vault/commit/9abc6a00fe2fa3fedcbfc3a3ab62c32030cd4602))
* **scraper:** catch cleanup errors to prevent crash at end of long runs ([bb6efc1](https://github.com/AtharvaCM/vehicle-vault/commit/bb6efc1a91ed293e32f3e7ba318504097f92f704))
* stabilize smoke flow with catalog forms ([430f60b](https://github.com/AtharvaCM/vehicle-vault/commit/430f60b0cd36be72221cce3d677946f1def45cb9))
* start api from compiled nest entry ([e341cc1](https://github.com/AtharvaCM/vehicle-vault/commit/e341cc101ec7216baa7bd70b82d9c2ef5aa3c161))
* **web:** add accessibility label to profile button for E2E tests ([1e9e341](https://github.com/AtharvaCM/vehicle-vault/commit/1e9e3411a3218f86cbf321c8df19f31a684cc6cb))
* **web:** clear new lint errors in vehicle-documents components ([3ca5768](https://github.com/AtharvaCM/vehicle-vault/commit/3ca5768a15ce8764f22d4c44f5069d9d2bc596ce)), closes [#19](https://github.com/AtharvaCM/vehicle-vault/issues/19) [#19](https://github.com/AtharvaCM/vehicle-vault/issues/19)
* **web:** sync E2E smoke test with redesigned UI labels ([6bd37b0](https://github.com/AtharvaCM/vehicle-vault/commit/6bd37b0d97a748a927de997ed08d7d6008c30a37))
* **web:** unwrap ApiSuccessResponse in vehicle-documents API ([1bbf2c9](https://github.com/AtharvaCM/vehicle-vault/commit/1bbf2c9424d84789dde2ff8010d4397390aad2dc))


### Features

* add api architecture foundation ([3e4a295](https://github.com/AtharvaCM/vehicle-vault/commit/3e4a29525f95ed7fce72cc5311c3dc207be22605))
* add attachment reconciliation tools ([3757bb0](https://github.com/AtharvaCM/vehicle-vault/commit/3757bb084ec169fcb31619a7fc21b46167c2dcee))
* add auth and user ownership ([693b120](https://github.com/AtharvaCM/vehicle-vault/commit/693b120df90452546f62fbd90af782287ffb4f07))
* add backend vehicle catalog ([7a722ec](https://github.com/AtharvaCM/vehicle-vault/commit/7a722ec3414763400de49845f135bbd5a6da3117))
* add bulk actions for maintenance and vehicles ([96c8555](https://github.com/AtharvaCM/vehicle-vault/commit/96c8555373dfe1f514464af65633ae1dfcc9ff64))
* add catalog offering review overrides ([b5f9c49](https://github.com/AtharvaCM/vehicle-vault/commit/b5f9c49f6f75d016429167d4b870e3b7b3005cd7))
* add list controls and delete confirmations ([d085c83](https://github.com/AtharvaCM/vehicle-vault/commit/d085c830251ee53b2ba7587a92b372999dbb965b))
* add maintenance overview and attachment polish ([9735b30](https://github.com/AtharvaCM/vehicle-vault/commit/9735b302171de10b097a3052259a26cb63571b13))
* add prisma postgres persistence ([172882d](https://github.com/AtharvaCM/vehicle-vault/commit/172882dcb851eaacd85c3cb4317b4da60dd20e45))
* add refresh token session renewal ([5bac291](https://github.com/AtharvaCM/vehicle-vault/commit/5bac291b3b3a6097f8898c457c20b8a0442c5a59))
* add reminder bulk actions ([55a59f0](https://github.com/AtharvaCM/vehicle-vault/commit/55a59f0b6bb0596c27491e68efd8793d75735220))
* add searchable vehicle catalog inputs ([3f62ef5](https://github.com/AtharvaCM/vehicle-vault/commit/3f62ef5ad03088344ee58b83d9dc148b02dea920))
* add staged catalog review workflow ([ec6da4e](https://github.com/AtharvaCM/vehicle-vault/commit/ec6da4e0f6452c99543f3a103df5f80bda40438b))
* add user account export ([b08a09c](https://github.com/AtharvaCM/vehicle-vault/commit/b08a09cd6f2148bd7c0590c409c72185635677ee))
* add vehicle catalog aliases and india coverage ([70f3f92](https://github.com/AtharvaCM/vehicle-vault/commit/70f3f92c858cf00393635a0dbc7cf0dae65a832f))
* add vehicle service trend insights ([1a69ed4](https://github.com/AtharvaCM/vehicle-vault/commit/1a69ed475cc018ccd23aee79afdda6de6158eb08))
* add web app architecture foundation ([4a13b23](https://github.com/AtharvaCM/vehicle-vault/commit/4a13b23caf3119ce38c44db7b3c3e57a86925bf6))
* add web edit flows for core records ([770dd61](https://github.com/AtharvaCM/vehicle-vault/commit/770dd615d4b74957a41a2b7317311b1caa3c28f0))
* add web ui system foundation ([9e462cd](https://github.com/AtharvaCM/vehicle-vault/commit/9e462cd9efb56c48ba2bc0eba7845c672407e7a1))
* AI readiness indicator for receipt scanner ([ff5fcc8](https://github.com/AtharvaCM/vehicle-vault/commit/ff5fcc805721fead94b88a3310cba67c371afbcf))
* **analytics:** cost-split donut + vehicle purchase metadata ([38da7d2](https://github.com/AtharvaCM/vehicle-vault/commit/38da7d24c65ff424b86fe34cf391a4464c830c99))
* **analytics:** monthly cost trend with cost-per-km ([ff08f7c](https://github.com/AtharvaCM/vehicle-vault/commit/ff08f7cee2bef1a2d323f8af359d9388f274c3cc))
* **analytics:** total cost of ownership card ([379fec5](https://github.com/AtharvaCM/vehicle-vault/commit/379fec5aebdf9a60da9b7d6c2bb194c452bc1f5f))
* **audit:** AuditEvent infrastructure + auth and vehicles emission ([8d82d28](https://github.com/AtharvaCM/vehicle-vault/commit/8d82d2862f50db133b2f30d040db7bbd50663b43))
* **audit:** wire emission through maintenance, reminders, fuel, claims, documents, attachments ([5687493](https://github.com/AtharvaCM/vehicle-vault/commit/56874933cfb6fa86052cc88f25d503f880472e0a))
* **auth:** Google + GitHub OAuth sign-in ([582958a](https://github.com/AtharvaCM/vehicle-vault/commit/582958a210ecace29c3252fd279a674b43f1a102))
* **auth:** introduce TokenService for email-verification lifecycle ([cf766cb](https://github.com/AtharvaCM/vehicle-vault/commit/cf766cb6695776aeb290b89837703b8d4e81cfd8)), closes [#4](https://github.com/AtharvaCM/vehicle-vault/issues/4) [#5](https://github.com/AtharvaCM/vehicle-vault/issues/5)
* **auth:** migrate password-reset lifecycle into TokenService ([d235b73](https://github.com/AtharvaCM/vehicle-vault/commit/d235b739ba7afbeb4300a451fa99d6677e394741))
* **auth:** migrate refresh JWT lifecycle into TokenService (timing-safe compare) ([b434a67](https://github.com/AtharvaCM/vehicle-vault/commit/b434a672215f2f4f239212499121f6e03386d579)), closes [#4](https://github.com/AtharvaCM/vehicle-vault/issues/4) [#14](https://github.com/AtharvaCM/vehicle-vault/issues/14) [#14](https://github.com/AtharvaCM/vehicle-vault/issues/14)
* automated catalog linkage and fuel tracking module ([701215a](https://github.com/AtharvaCM/vehicle-vault/commit/701215af0a908d8c65c2712f6541250867b6797e))
* **catalog:** add automated CarWale scraper CLI for Indian market catalog data ([9eda55e](https://github.com/AtharvaCM/vehicle-vault/commit/9eda55e2018a221f60cb2108d4b0b11d9587eac7))
* **catalog:** expand VW and Skoda India snapshots with Tayron, Kodiaq, Superb and variants ([6431c49](https://github.com/AtharvaCM/vehicle-vault/commit/6431c49a187dbb598b85ba2f4ac37d90112b913f))
* **catalog:** massive expansion of Indian market 2-wheeler and 4-wheeler snapshots and aliases ([c3a27dd](https://github.com/AtharvaCM/vehicle-vault/commit/c3a27dd0eb34c483538bf46d689c453ac070e8ab))
* **catalog:** scrape all 17 Indian market brands from CarWale with 300+ models ([10ba18c](https://github.com/AtharvaCM/vehicle-vault/commit/10ba18c9ad03b3cd829f9d6abd7dd8b6c1455917))
* **catalog:** support optional auto-publish in import script via --publish flag ([31f06df](https://github.com/AtharvaCM/vehicle-vault/commit/31f06df82e3f639552c3d492bfc8cb45bdd736d9))
* **claims:** AI-extracted suggestions from claim attachments ([#26](https://github.com/AtharvaCM/vehicle-vault/issues/26)) ([e87f242](https://github.com/AtharvaCM/vehicle-vault/commit/e87f242e0c807db8f138fa8e92373f09248ccdcb))
* **claims:** attachments support (receipts, photos, surveyor reports) ([#25](https://github.com/AtharvaCM/vehicle-vault/issues/25)) ([2bba787](https://github.com/AtharvaCM/vehicle-vault/commit/2bba787fe0a913ac77f97a87864599d40a27e017))
* **claims:** editable AI suggestion before applying to claim ([#27](https://github.com/AtharvaCM/vehicle-vault/issues/27)) ([beb666e](https://github.com/AtharvaCM/vehicle-vault/commit/beb666ee55bec9a1ca1eed1734da05c43d31b99b))
* **claims:** insurance-claim entity linking policies to maintenance records ([#21](https://github.com/AtharvaCM/vehicle-vault/issues/21)) ([d309ce0](https://github.com/AtharvaCM/vehicle-vault/commit/d309ce08c3ec9102af8e82b6585401ee5d3c0162))
* expand vehicle catalog generations and import tracking ([a590a55](https://github.com/AtharvaCM/vehicle-vault/commit/a590a551ab2712586c94ea816235a229acc2047a))
* **extraction:** document-extraction engine + insurance-policy kind ([#31](https://github.com/AtharvaCM/vehicle-vault/issues/31)) ([90f4e81](https://github.com/AtharvaCM/vehicle-vault/commit/90f4e813cf21d248b284dba9a4db2822e191460a))
* gemini receipt OCR (Phase 6.2) - automated fuel logging via vision AI ([2ce98be](https://github.com/AtharvaCM/vehicle-vault/commit/2ce98beaa627e61f78832d49b023c68bc43f862b))
* guard unsaved form changes ([37da013](https://github.com/AtharvaCM/vehicle-vault/commit/37da013a2f6c2344ed9fd2fb15512eb4ea834e10))
* implement attachments vertical slice ([66d218f](https://github.com/AtharvaCM/vehicle-vault/commit/66d218f8432fb8e394b6992ecf1815269123a8c5))
* implement email verification, insurance/warranty management, and maintenance forecasting modules ([a5dc84f](https://github.com/AtharvaCM/vehicle-vault/commit/a5dc84f25612c0f98127e4c19bce40241b11d005))
* implement maintenance records vertical slice ([1d412a1](https://github.com/AtharvaCM/vehicle-vault/commit/1d412a1a8a33d661a3b07196f58e2ca90d6e751f))
* implement reminders vertical slice ([b8354f7](https://github.com/AtharvaCM/vehicle-vault/commit/b8354f70cbd91f2b6f76eb20898ceb9d0a90e1b9))
* implement vehicles vertical slice ([837aa12](https://github.com/AtharvaCM/vehicle-vault/commit/837aa123460d048ba0a3aaab7efa19b5a953f8f5))
* integrate Swagger API documentation and add metadata decorators to controllers and DTOs ([12cc45f](https://github.com/AtharvaCM/vehicle-vault/commit/12cc45f416c579a706eea65097da5cd98250aa24))
* **maintenance:** link insurance claim from the record itself ([#23](https://github.com/AtharvaCM/vehicle-vault/issues/23)) ([891f41e](https://github.com/AtharvaCM/vehicle-vault/commit/891f41ecce8ae8548bebb5ae57e6f5330a039028)), closes [#21](https://github.com/AtharvaCM/vehicle-vault/issues/21) [#21](https://github.com/AtharvaCM/vehicle-vault/issues/21)
* move attachments to supabase storage ([f302be1](https://github.com/AtharvaCM/vehicle-vault/commit/f302be18019aca847056527d3de376d5f434bc71))
* **notifications:** document-expiring template + findExpiring range query ([ee2544f](https://github.com/AtharvaCM/vehicle-vault/commit/ee2544f24bb2c29ce4ec71311cb231135fb931b7)), closes [#7](https://github.com/AtharvaCM/vehicle-vault/issues/7) [2/#6](https://github.com/AtharvaCM/vehicle-vault/issues/6)
* **notifications:** migrate remaining alert kinds to NotifyService ([3ce1baf](https://github.com/AtharvaCM/vehicle-vault/commit/3ce1baf736ea8a6dd24b803b07d15ca640b80c2b)), closes [#8](https://github.com/AtharvaCM/vehicle-vault/issues/8)
* **notifications:** NotifyService scaffold with maintenance-due tracer ([c3da083](https://github.com/AtharvaCM/vehicle-vault/commit/c3da083977d6447d105c373d52071d8ecaf5f684))
* odometer forecasting and vehicle intelligence dashboard ([8062c24](https://github.com/AtharvaCM/vehicle-vault/commit/8062c24aea495d88fbd34e85942264a4cceed737))
* persist list filters in route search params ([a3f2e16](https://github.com/AtharvaCM/vehicle-vault/commit/a3f2e16f6ba587996fd7b892b460d29979b46f6c))
* polish web forms with shadcn primitives ([b1082f3](https://github.com/AtharvaCM/vehicle-vault/commit/b1082f3866c593c9c62b7387c672e32696e2f5b5))
* proactive email alerts for maintenance (Phase 5.1) ([0b993f8](https://github.com/AtharvaCM/vehicle-vault/commit/0b993f86cdf60d2f36e4f87930daa35a32a6f5a0))
* proactive notification engine (Phase 5.1) - maintenance alerts & inbox UI ([b162439](https://github.com/AtharvaCM/vehicle-vault/commit/b16243998a09708c999f13d89bc75733bcec844b))
* refine dashboard and core product flows ([4b54654](https://github.com/AtharvaCM/vehicle-vault/commit/4b5465462e3577249a9372603442e2b58ecf923c))
* **reports:** downloadable PDF service history ([bfdbcd1](https://github.com/AtharvaCM/vehicle-vault/commit/bfdbcd1f41f14de5eea5dcdb36d06564aeefd194))
* **schema:** polymorphic Attachment owner with CHECK-one-owner constraint ([1f49c8f](https://github.com/AtharvaCM/vehicle-vault/commit/1f49c8f927100989901d5bcb16fe653b29610693))
* seamless data ingestion (Phase 6.1) - premium bulk CSV import ([4b69c01](https://github.com/AtharvaCM/vehicle-vault/commit/4b69c013b7f11bbff98a1ec8da8649ad54641341))
* send reset emails and stabilize ci storage ([6e8e9da](https://github.com/AtharvaCM/vehicle-vault/commit/6e8e9dae2d608e02dce76904e6b6a6171c5f5d89))
* **specs:** add puppeteer-based scale scraper for CarWale variant specs ([3410d14](https://github.com/AtharvaCM/vehicle-vault/commit/3410d1435d61a8788acb2b647f6cfd1253a1c74a))
* **specs:** add vehicle specs schema, API, frontend tab, and seed data ([d2cc363](https://github.com/AtharvaCM/vehicle-vault/commit/d2cc363ca5f61b02033d21dad67f75954880e6ee))
* support heic and multi-page maintenance OCR ([cb7c06f](https://github.com/AtharvaCM/vehicle-vault/commit/cb7c06f54fe64e2e9dca783cf98ccb6cb0bd8d1b))
* **vehicle-documents:** unified service over insurance + warranty ([6910c7d](https://github.com/AtharvaCM/vehicle-vault/commit/6910c7d92d6a8c34abfb6e89c22b5a4b67db490f)), closes [#8](https://github.com/AtharvaCM/vehicle-vault/issues/8) [#9](https://github.com/AtharvaCM/vehicle-vault/issues/9) [#10](https://github.com/AtharvaCM/vehicle-vault/issues/10)
* **web:** unify insurance + warranty into vehicle-documents feature ([c508888](https://github.com/AtharvaCM/vehicle-vault/commit/c50888882a167b0b081d6bcd5d26799c435ee472)), closes [#9](https://github.com/AtharvaCM/vehicle-vault/issues/9)


### Performance Improvements

* split web routes and refine prod origins ([f23f695](https://github.com/AtharvaCM/vehicle-vault/commit/f23f695324d8766fbc358583f0e8da5e2b6f7619))
