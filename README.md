# Drill Orbit

**▶ Main langsung: https://irvanfaturohman.github.io/drill-orbit/**

Prototype hybrid casual. Tap timing buat luncurin pod bor, nonton dia terbang dan mantul
lewat landmark, terus nyetir sendiri pas ngebor bawah tanah ngumpulin mineral. Portrait,
jalan di HP sama desktop.

Vanilla JS + Canvas 2D. **Nol dependency, nol build step, nol file aset** — semua gambar dan
suara dibikin prosedural. Clone terus buka `index.html`, atau:

```bash
python3 -m http.server 8000    # http://localhost:8000
node build.mjs                 # -> dist/drill-orbit.html (satu file, opsional)
```

**Kontrol.** Tap/klik di mana aja buat luncurin. Pas ngebor: tahan sisi kiri/kanan layar,
atau `A`/`D`/panah. `Space` juga bisa. Tombol ⚙ kanan-bawah buka panel debug (koin, level,
Auto Perfect, tampilkan zona pendaratan, reset).

Progress kesimpen di `localStorage` per browser.

> Ini prototype buat nguji rasa main, bukan game jadi. Iklannya **placeholder** — nol SDK,
> nol network, cuma niru bentuk rewarded video buat ngetes loop-nya.

---

## Loop-nya

Meteran timing bolak-balik → tap → pod lepas 52° → **terbang, mantul, gelinding, berhenti**
→ jeda 0,6 detik → hidungnya muter ke bawah, kamera nyelam (zoom 1.0 → 2.4, satu ruang
koordinat, gak ada potong) → **sekarang pemain pegang kendali**: tahan kiri/kanan buat
nyetir sambil turun → nyerempet mineral, nabrak batu → penuh atau mentok kedalaman → koin
→ upgrade → tap lagi.

**Kontrol.** Tap/klik di mana aja buat luncurin. Pas ngebor: tahan sisi kiri/kanan layar,
atau `A`/`D`/panah. `Space` juga bisa buat luncur dan lanjut dari layar hasil.

---

## Yang bikin dua fase ini nyambung, bukan ditempel

Fase 1 nentuin **di mana** fase 2 terjadi, dan itu yang bikin jarak punya arti kedua di
luar angka. Biome nentuin isi tanahnya:

| | commons | rare (tier 2) |
|---|---|---|
| Grassland (0–300m) | 82% | **3%** |
| Desert (300–700m) | 38% | **18%** |
| Volcanic (700m+) | 28% | **26%** |
| **Ancient Mine (~500m)** | 37% | **31%** + kedalaman ×1.5 |

Angka itu diukur (`World.genUnderground` × 4 biome), bukan dikira-kira. Jadi "terbang lebih
jauh" bukan cuma skor lebih gede — itu **ladang mineral yang beda**. Dan Ancient Mine di
495–530m itu satu-satunya alasan buat pengen mendarat di titik tertentu, bukan sejauh
mungkin. Terrain di situ dicekungin jadi baskom + friksi gelinding dinaikin 2,7× biar pod
yang nyampe beneran nyangkut, bukan lewat.

**Teaser kedalaman.** Di bawah garis MAX DEPTH digambar mineral yang keliatan tapi gak
kegapai, diredupin, plus tulisan UPGRADE DRILL TO GO DEEPER. Itu bikin upgrade DRILL punya
target visual, bukan cuma persen.

---

## Ekonomi

Payout jarak sengaja **sublinear**: `14 × √meter`. Alasannya kelihatan pas disimulasi 14 run
berturut-turut — kalau linear, di run ke-10 koin jarak nelen koin mineral (240c vs 90c) dan
fase ngebor jadi gak ada artinya secara ekonomi. Dengan akar:

```
r 1  138m   mineral  10c(3)  + jarak 165c   → beli POWER ×2
r 5  229m   mineral  16c(6)  + jarak 212c   → beli DRILL ×2
r 9  300m   mineral 143c(8)  + jarak 242c   → mineral nyusul
r14  218m   mineral 157c(10) + jarak 207c   → mineral nyalip
```

Jadi jarak yang narik pemain di 8 run pertama (tiap run kebeli sesuatu), terus mineral yang
ambil alih begitu STORAGE/DRILL/biome udah naik. 13 dari 14 run kebeli minimal satu upgrade.

**Progression jarak** (diukur headless, `Pod.updateFlight` di Node):

| Power/Bounce | WEAK | GOOD | GREAT | PERFECT | pantulan |
|---|---|---|---|---|---|
| Lv 1 / 1 | 20m | 38m | 67m | **103m** | 4 |
| Lv 5 / 3 | 41m | 92m | 213m | **296m** | 7 |
| Lv 10 / 6 | 98m | 227m | 387m | **732m** | 19 |
| Lv 20 / 12 | 303m | 814m | 678m | **1561m** | 17 |

PERFECT itu lompatan tajam disengaja (mult 1.15 vs 0.91 di GREAT — jangkauan hampir 1,6×),
biar timing tetap kerasa penting sampai akhir, bukan cuma di run pertama.

---

## Catatan implementasi

**Satu ruang koordinat buat permukaan dan bawah tanah.** Transisi ke fase ngebor itu cuma
kamera: zoom 1.0 → 2.4, anchor 0.55 → 0.34, sambil pod-nya nyelam masuk tanah. Gak ada
fade, gak ada ganti scene. Ini yang bikin sambungannya kebaca mulus — dan alasannya kenapa
skala meter (`CFG.M = 8 px/m`) sama di dua fase.

**Bounce vs gelinding.** Tumbukan dengan komponen normal >95 px/s = mantul (refleksi ×
restitusi, gesek tangensial 0,955). Di bawah itu pod **beralih ke mode gelinding**: komponen
normal dibuang, gravitasi diproyeksi ke tangen, friksi gelinding jalan. Tanpa mode kedua ini
pod bergetar di lereng landai dan berhenti terlalu cepat.

**Slope limiter.** Heightfield dibatasi kemiringannya (4 pass, maks 0,55) supaya gak ada
tebing yang bisa mantulin pod ke belakang. Sekarang jadi guard — amplitudo noise-nya udah
di bawah batas — tapi tetap dipasang karena satu tebing aja bikin run kebaca sebagai bug.

**Runway nurun.** 60m pertama di-blend dari ramp landai turun ke noise. Sebelum ini,
luncuran WEAK mendarat di tanjakan terus **gelinding balik ke belakang pad** — fisikanya
bener, bacaannya kayak rusak.

Semua gambar dan suara prosedural. Progress di `localStorage` (`drillorbit.save.v1`).
Panel debug: tombol ⚙ kanan-bawah — coins, 4 level upgrade, +1000 koin, Max Power,
Auto Perfect (buat nge-tes jarak tanpa gangguan timing), mute, reset.

---

## Yang perlu dinilai jujur

**Fase ngebor lebih tipis dari fase terbang.** Nyetir kiri-kanan sambil turun itu satu sumbu
keputusan; yang bikin menarik cuma sebaran mineral dan batu yang ngelambatin. Sepuluh run
pertama enak. Run ke-tiga puluh — sama kayak `arrow-orbit`, ini pertanyaan yang gak bisa
dijawab dari dalam prototype-nya.

**Storage nutup kedalaman.** Di level tinggi run sering selesai karena penuh di 40–60m,
padahal MAX DEPTH-nya 100m+. Itu tegangan yang disengaja (DRILL vs STORAGE saling butuh),
tapi efek sampingnya: **upgrade DRILL sering gak keliatan hasilnya** sampai STORAGE nyusul.
Ini yang paling perlu dites ke orang lain — apakah kebaca sebagai keputusan, atau sebagai
upgrade yang berasa nipu.

**Ancient Mine itu lotre.** Pemain gak bisa ngarahin ke 495–530m; dia cuma bisa naikin POWER
sampai kebetulan mendarat di sana. Baskom + friksi bikin peluangnya naik, tapi tetap gak ada
skill di dalamnya. Kalau zona ini mau jadi hook beneran, pemain butuh cara ngerem.

**Variansi terrain masih kebaca.** Level upgrade yang sama bisa mendarat 40% beda tergantung
pod-nya mendarat di lereng naik atau turun. Slope limiter udah nolongin banyak, tapi tabel
di atas itu satu sampel per sel, bukan rata-rata.

---

## Revisi juice (8 Sep 2026) — dari feedback *"kurang satisfying somehow"*

Irvan main di HP dan gak bisa nunjuk bagiannya. Empat hal keukur, dan tiga di antaranya
ketahuan cuma karena diukur, bukan dilihat:

**1. Lintasannya ceper.** `apex/range = tan(θ)/4` — di 46° itu 0,26, jadi pod **nyerempet**
tanah, bukan melengkung. Bentuk busur cuma ditentukan sudut; naikin kecepatan atau turunin
gravitasi gak ngubah bentuknya sama sekali, cuma ngegedein. Sudut dinaikin ke **52°** (apex
0,32, +30% waktu di udara), gravitasi 1600→1250, `BASE_V` 780→650 buat nahan jaraknya tetap
di band 80–150m.

**2. Nol hitstop.** Ini yang paling parah kelewat. Ada shake, ada partikel, tapi **gak ada
freeze frame** — jadi tiap tumbukan kerasa lembek. Sekarang tiap benturan nge-freeze
`timeScale` ke 0.02: pantulan 18–73ms (skala impact), mendarat 60ms, luncur 50–85ms, mineral
langka 100ms. Hitstop menang di atas slow-mo — freeze itu baca-nya *benturan*, slow-mo
baca-nya *drama*.

**3. Pantulannya langsung mati.** Restitusi 0,42 dan ambang mantul-vs-gelinding 95px/s bikin
pod cuma mantul 3x terus berhenti. Jadi **0,56** dengan ambang 62 — run pertama 4 pantulan,
mid-game 7–19. Fantasy "loncat nyeberang dunia"-nya baru kejadian sekarang, dan upgrade
BOUNCE jadi keliatan.

**4. 1,5 detik mati total.** Settle 0,75s + dive 0,75s = satu setengah detik tanpa input dan
tanpa apa-apa terjadi, persis di tengah run. Dipotong ke 0,6 + 0,45, dan beat settle-nya
sekarang **nyetak angka jaraknya** gede-gede, bukan diem doang.

**Plus dua hal yang nambah, bukan mbenerin:**

**Anticipation sebelum luncur.** Tap → pod **memampat 110ms** sambil energi ngumpul → baru
lepas, dengan hitstop di titik lepasnya. Sebelumnya luncurannya instan; gak ada tarikan napas
sebelum ledakan.

**Chain mineral.** Ngambil mineral dalam 1,15 detik dari yang sebelumnya naikin chain —
pengali nilai ×1 → ×3 (cap), nadanya naik, teks `CHAIN ×2`. Ini yang bikin **nyetir jadi ada
skill-nya**: sebelumnya nyetir cuma "arahin ke mineral terdekat", sekarang ada alasan buat
mikirin *urutan*. Bot dengan setiran asal dapet chain ×7 sekali; ini yang paling perlu dites
tangan.

**Audio dikasih bass.** Semua benturan dulu tone tipis 150–900Hz — di speaker HP itu
kedengeran kayak gak ada apa-apa. Sekarang tiap impact ada `thump()`: sinus rendah yang
pitch-nya jatuh cepet (150→42Hz pas luncur, 130→30Hz pas mendarat).


### Setiran bawah tanah (8 Sep 2026) — dari feedback *"pantatnya yang goyang"*

Dua bug numpuk, dua-duanya soal **orientasi**, bukan soal fisikanya:

**Sudutnya kurang 15,6°.** Hidung digambar pakai lean buatan `π/2 + (vx/vxMax) × 0.42` yang
di-cap 24°, padahal arah gerak aslinya sampai 40°. Jadi pod **ngesot nyamping** — badannya
gak pernah nunjuk ke arah dia jalan. Diganti `atan2(vy, vx)` biasa, sama kayak fase terbang.
Di-clamp ±54° dari tegak, soalnya pas kena batu `vy` anjlok ke 16 dan tanpa clamp hidungnya
ngayun lewat horizontal — kebacanya jadi terbang nyamping, bukan ngebor.

**Titik putarnya di pinggang.** Geometri pod itu +2.05R (mata bor) sampai -1.5R (booster),
tapi `rotate()` muter di titik 0 — tengah badan. Jadi ujung ngayun 39px, pantat ngayun 28px,
dan karena pantat itu bagian gendut sedangkan ujungnya cuma segitiga tipis, **yang kebaca
mata ya pantatnya**. Sekarang gambarnya digeser mundur `NOSE_PIVOT = 0.95R` biar `(x,y)` —
titik tabrakan sekaligus titik ukir terowongan — ada di **mata bor**. Badannya ngekor di
belakang, ngikut terowongan yang barusan dia potong. Pad peluncurnya ikut digeser 17px biar
pod-nya tetap kelihatan duduk pas di atasnya.

Sekalian `DRILL_VX_MAX` diturunin 58 → 44. Angka 58 itu sisa dari revisi juice sebelumnya,
dan begitu hidungnya jujur ngikut kecepatan, 58 bikin pod jalan 49° dari tegak — kebacanya
kayak pesawat, bukan bor. Di 44: 41° di permukaan, 29° pas dalam.


---

## Restrukturisasi alur (8 Sep 2026) — upgrade di layar utama + rewarded ad

Sebelumnya upgrade numpang di sheet hasil, jadi satu-satunya cara lihat harga upgrade itu
**harus nyelesein run dulu**. Sekarang bentuknya kayak hybrid-casual beneran:

**Layar utama** punya bar upgrade permanen di bawah — 4 tombol ringkas (POWER / BOUNCE /
DRILL / STORAGE) dengan level dan harga selalu kelihatan, jadi pemain bisa lihat target
berikutnya *sebelum* mutusin mau luncur. Meteran timing digeser naik ke atas bar; tingginya
dibaca dari DOM (`--bar-h`) biar canvas dan DOM gak tabrakan.

**Layar hasil** sekarang murni "kamu dapet apa": jarak, kedalaman, jumlah mineral, koin plus
rinciannya, dan chip tiap jenis mineral. Tombolnya **COLLECT**, bukan LAUNCH AGAIN.

**Rewarded ad — placeholder, bukan iklan beneran.** Tombol `WATCH AD ×2` di layar hasil buka
overlay yang niru bentuk rewarded video (badge AD PLACEHOLDER, bar animasi, hitung mundur 3
detik), terus koin run itu dikaliin `CFG.AD_MULT` dengan animasi angka naik. Sekali per run.
**Nol SDK, nol network, nol request** — yang dites cuma bentuk loop-nya: apakah tawarannya
kerasa layak diambil.

Konsekuensi ekonomi yang harus disadari pas nge-tes: kalau iklannya selalu ditonton,
pemasukan **dua kali lipat**, jadi progression-nya kira-kira dua kali lebih cepet. Di simulasi
8 run berturut-turut (run → iklan → COLLECT → belanja dari bar), **tiap run kebeli minimal
satu upgrade** dan best-nya nyampe 439m di run ke-8. Angka `AD_MULT` ada di `CFG` kalau mau
dicoba ×3.

Detail kecil: tombol debug ⚙ disembunyiin pas sheet hasil kebuka (dia float di atas sheet dan
nutupin `×2`), dan tap di bar upgrade gak ikut nge-launch (`isUI` di `bindInput`).


---

## Revisi "one more try" (8 Sep 2026)

Fokusnya cuma fase luncur. Fase ngebor **sengaja gak disentuh** selain nerima bonus dari
zona pendaratan.

**PERFECT jadi state, bukan teks.** Dulu PERFECT itu banner sedetik. Sekarang dia nyalain
**OVERDRIVE** — pod-nya glowing oranye-putih, trail-nya tiga lapis dan lebih panjang, speed
streak-nya turun ambang jadi 300px/s, ada spark, kamera nambah zoom-out dan lead. Jalan 2,6
detik, dan **pantulan besar pertama nambahin 1,5 detik lagi** plus hitstop 110ms, shockwave
dobel, dan teks OVERDRIVE!. Jadi PERFECT ngubah seluruh run, bukan cuma awalnya.

**Meter-nya sekarang RED | YELLOW | GREEN | PERFECT | GREEN | YELLOW | RED.** Pita PERFECT
digambar **dari ambang aslinya** (`(1-PERFECT_ACC)/2` di tiap sisi = 10% lebar meter), putih
menyala, berdenyut, dikotakin garis tegas, ada label PERFECT dan dua panah nunjuk ke dalam.
Ambangnya gak diubah — yang berubah cuma pemain jadi tau persis dia meleset berapa.

**SO CLOSE! (acc 0,84–0,90).** Cuma presentasi — multiplier-nya tetap sama persis kayak
GREAT. Ada hitstop kecil, flash kuning tipis, dan nada turun. Muncul cuma buat meleset tipis.

**Peta awal dipadetin.** 12 site: SUPPLY CRATE 58m, CRYSTAL PIT 96m, ??? 132m, STONE ARCH
172m, METEOR CRATER 224m, OLD BRIDGE 272m, ??? 344m, OBELISK 430m, ANCIENT MINE 512m, ??? 664m,
LAVA TUBE 884m, ??? 1160m. Tiga peran: **decor** (cuma pemandangan), **milestone** (mendarat
di situ dapet hadiah), **mystery** (tampil `???` sampai pertama kali dicapai, terus namanya
kebuka permanen). Prop dekoratif juga dirapetin: 20–62px sekali di 200m pertama, plus tipe
baru (rambu jarak, rumpun rumput, drum).

**Hadiah pendaratan:** SUPPLY CRATE +90 koin, CRYSTAL PIT rare ×3,2 (grassland 5% → 11%),
METEOR CRATER +14m kedalaman, ANCIENT MINE tetap ×1,5 kedalaman + rare ×2,2.

**Near-miss — ini intinya.** Berhenti di luar zona tapi masih dalam jangkauan `near`
(7–12m tergantung zona) munculin **`4m SHORT!`** atau **`3m TOO FAR!`**, beat settle
dipanjangin 0,6 → 1,0 detik, dan **kameranya mundur sampai pod DAN zona yang meleset
dua-duanya kelihatan sebidang**. Tanpa framing itu angkanya gak ada artinya.

**Anti-acak.** Near-miss cuma jalan kalau pemain nyalahin timing-nya sendiri. Amplitudo noise
300m pertama diredam ke 0,34× dan batas kemiringannya diperketat (0,22 → 0,55 step). Hasilnya
**timing + level yang sama = jarak yang persis sama tiap run** — fisika tetap jalan, tapi nol
keacakan. Itu disengaja: janji "sekali upgrade lagi gw nyampe" jadi bener secara harfiah.

**BEST chase.** Masuk 45m dari rekor, muncul hitungan mundur `BEST 18m →` yang gantiin baris
BEST statis, denyutnya naik di bawah 12m, dan nadanya naik tiap 1/5 jarak. Lewat rekor →
NEW BEST! plus hitstop dan ring.

**NEXT + strip.** `NEXT / CRYSTAL PIT / 38m` ngitung mundur ke tepi zona berikutnya (decor
gak pernah masuk UI). Strip di atas: `● YOU ─ ◆ SUPPLY 58m ─ ◆ CRYSTAL 96m ─ ? ??? 132m`.

### Tuning

| | sebelum | sesudah |
|---|---|---|
| amplitudo terrain 0–300m | 1,0× | 0,34× → 1,0× |
| batas kemiringan | 0,55 | 0,22 → 0,55 |
| cekungan zona | 34px (mine) | 8px (26px mine) |
| friksi gelinding di zona | cuma mine | semua zona (5,2) |
| CRYSTAL PIT rare | — | ×3,2 |

Jarak Lv1: WEAK 36m · GOOD 55m (crate) · GREAT 70m (3m TOO FAR) · SO CLOSE 73m (crate) ·
PERFECT 132m (??? kebuka). Lv2 PERFECT 142m = 1m TOO FAR dari wreck. Lv3 PERFECT 208m =
4m SHORT dari crater.

### Dua bug yang ketangkep pas nge-tes

**Cekungan zona itu perangkap energi.** Versi pertama bikin **PERFECT berhenti di 59m
sementara GOOD nyampe 99m** — pod cepat nabrak dinding jauh cekungan dan mati. Sekarang zona
nahan pod pakai **friksi**, bukan dinding; geometrinya cuma buat ngeratain jalur pendekatan.

**`Save.DEF.found` itu array yang di-share.** `Object.assign({}, DEF, data)` nyalin
*referensi*-nya, jadi tiap `found.push()` ngotorin DEF — penemuan bocor lewat reset dan gak
pernah kehapus. Sekarang di-clone pas load.

### Sengaja gak diubah

Fase ngebor (setir, mineral, batu, storage, chain, rare find), ekonomi, iklan placeholder,
struktur upgrade, dan seluruh sistem juice yang udah ada.
