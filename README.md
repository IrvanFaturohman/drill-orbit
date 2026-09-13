# Drill Orbit

**▶ Main langsung: https://irvanfaturohman.github.io/drill-orbit/**

Prototype hybrid casual. Tap timing buat luncurin pod bor, nonton dia melengkung tinggi
dan **nancep ke tanah kayak meteor**, terus nyetir sendiri pas ngebor bawah tanah ngumpulin
mineral. Portrait, jalan di HP sama desktop.

Vanilla JS + Canvas 2D. **Nol dependency, nol build step, nol file aset** — semua gambar dan
suara dibikin prosedural. Clone terus buka `index.html`, atau:

```bash
node serve.mjs                 # http://localhost:8000  (dev server, no-cache)
node build.mjs                 # -> dist/drill-orbit.html (satu file, opsional)
```

> Pakai `node serve.mjs`, jangan `python3 -m http.server`. Yang python gak ngirim header
> `Cache-Control` sama sekali, jadi browser nebak sendiri dan nahan `js/*.js` yang lama
> setelah file diedit. Itu sempat bikin satu ronde "tombolnya gak ada" padahal file di disk
> udah bener. Kalau cache-nya terlanjur kotor, sekali **hard refresh** (`Cmd+Shift+R`, atau
> di HP: tahan tombol reload) buat bersihin. Baris paling bawah panel debug nampilin
> `build:` dari konstanta `BUILD` di `js/utils.js` — itu cara tercepat mastiin build yang
> kebuka emang yang barusan diedit.

**Kontrol.** Satu jari, satu keputusan: **tap buat luncurin pas meteran di hijau**. Di udara
gak ada kontrol sama sekali — itu disengaja. Pas ngebor: tahan sisi kiri/kanan layar, atau
`A`/`D`/panah. `Space` juga bisa. Tombol ⚙ kanan-bawah buka settings (koin, level, Auto
Perfect, shake, haptics, overlay zona, baris `build:`).

Progress kesimpen di `localStorage` per browser.

> Ini prototype buat nguji rasa main, bukan game jadi. Iklannya **placeholder** — nol SDK,
> nol network, cuma niru bentuk rewarded video buat ngetes loop-nya.

---

## Loop-nya

Meteran timing bolak-balik → **tap** → pod lepas 60° → **naik tinggi** → apex, sesaat
nyaris tanpa bobot → **jatuh, makin cepet, angin makin kenceng** → **BOOM**: hitstop, layar
goyang, kawah, bongkahan tanah muncrat → **bor nyobek tanah otomatis** sambil angkanya
lari `4m 9m 14m 21m` → energi tumbukan habis, bor melambat, berhenti → **IMPACT DEPTH 24m**
→ motor bor nyala → **sekarang pemain nyetir**: tahan kiri/kanan sambil turun, ngumpulin
mineral, chain → mentok MAX DEPTH → koin → upgrade → tap lagi.

Tiga upgrade: **POWER** (kecepatan luncur) · **IMPACT** (efisiensi energi jadi penetrasi) ·
**DRILL** (jangkauan ngebor manual). Gak ada kapasitas angkut — satu-satunya yang ngakhiri
run itu kedalaman.

Pertanyaan yang dijawab tiap run bukan lagi "berapa kali gw bisa mantul", tapi
**"seberapa keras gw bisa nancepin bor ini ke tanah"**.

**Kontrol.** Tap buat luncurin, itu doang di permukaan. Timing nentuin energi, energi
nentuin kedalaman tumbukan, kedalaman tumbukan jadi kedalaman gratis sebelum fase ngebor
manual dimulai.

---

## Yang bikin dua fase ini nyambung, bukan ditempel

Fase 1 nentuin **di mana** fase 2 terjadi, dan itu yang bikin jarak punya arti kedua di
luar angka. Biome nentuin isi tanahnya:

| | commons | rare (tier 2) |
|---|---|---|
| Grassland (0–400m) | 82% | **3%** |
| Desert (400–1100m) | 38% | **18%** |
| Volcanic (1100m+) | 28% | **26%** |
| **Ancient Mine (~712m)** | 37% | **31%** + kedalaman ×1.5 |

Angka itu diukur (`World.genUnderground` × 4 biome), bukan dikira-kira. Jadi "terbang lebih
jauh" bukan cuma skor lebih gede — itu **ladang mineral yang beda**. Dan Ancient Mine di
695–730m itu satu-satunya alasan buat pengen mendarat di titik tertentu, bukan sejauh
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

**~~Storage nutup kedalaman.~~** *Diselesaikan 11 Sep 2026 dengan mencabut STORAGE
sepenuhnya — lihat bagian paling bawah.*

**Ancient Mine masih setengah lotre.** Sejak ada HOLD-to-dive, pemain akhirnya bisa milih
*kapan turun*, jadi zona 695–730m bukan murni keberuntungan lagi. Tapi dia masih gak bisa
**ngerem** — kalau pod-nya dateng kecepetan, satu-satunya pilihan cuma lewat. Itu yang bikin
METEOR CRATER gak bisa didarati di Lv1 padahal jaraknya kegapai. Kandidat paling kuat buat
pass berikutnya: tahan pas gelinding = friksi ekstra.

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
LAVA TUBE 884m, ??? 1160m. *(Posisi ini di-stretch ulang 11 Sep 2026 — lihat bagian paling
bawah. Yang berlaku sekarang cuma SUPPLY CRATE 58m.)* Tiga peran: **decor** (cuma pemandangan), **milestone** (mendarat
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


---

## Revisi fase terbang (11 Sep 2026) — HOLD TO DIVE + booster pad

Sebelum ini fase terbang itu **nonton**: sekali tap, sisanya fisika. "Ancient Mine itu
lotre" di catatan atas ada karena gak ada satu pun cara buat ngerem atau ngejar. Revisi ini
cuma nyentuh fase permukaan; bawah tanah, ekonomi, iklan, dan layar hasil gak disentuh.

### Satu kontrol baru: TAHAN = nyelam

Pas `flying`, tahan di mana aja (atau `Space`) → pod dapet percepatan ke bawah
`FLIGHT_DIVE_ACCEL` 2600 px/s² di atas gravitasi (~2,1g). Dari puncak busur Lv1 pod nyampe
tanah 0,27 detik, bukan 0,47. Lepas → langsung balistik biasa. Gak ada kiri/kanan, gak ada
naik. `vx` kena drag kecil 0,3/s selama nahan (0,3 detik = -9%) biar nyelam ada harganya
tapi gak kebaca sebagai rem.

**Aturan energi — ini yang bikin semuanya jalan.** Kecepatan yang ditambahin dive
(`pod.diveVy`) **dibuang lagi pas kena tanah**, jadi pantulannya dihitung dari kecepatan
yang bakal dihasilkan gravitasi doang. Tanpa aturan ini, "lepas pas naik, tahan pas turun"
mompa energi ke tiap pantulan: dengan restitusi 0,8 (BOUNCE max) × √(3850/1250) = 1,4 > 1,
pod-nya gak pernah mendarat. Sekarang **nyelam cuma bisa memperpendek** — satu-satunya cara
nambah jarak ya booster. Kalau nyelam pas masih naik (komponen alaminya masih ke atas), pod
nyangkut jadi gelinding: "gw nahan kepagian" kebaca jelas.

**Tap peluncur gak dihitung.** Jari yang nge-launch harus dilepas dulu (`input.diveArmed`),
baru tahanan berikutnya jadi dive. Sama buat `Space`. Dan **hit booster ngabisin
tahanannya**: harus lepas dan tahan lagi. Tanpa ini, jari yang masih nempel 150 ms setelah
BOOST! (latency lepas manusia) ngedorong busur baru balik ke tanah dan run-nya mati — kejadian
di *tiap* hit waktu dites.

### Booster pad

20 pad deterministik, diposisiin dalam meter tempuh kayak `SITES`, gak pernah di zona
pendaratan / pita near-miss, gak pernah di kelipatan 100 m (rambu jaraknya numpuk di
atas pad). Skin per biome, mekanik sama: **pegas** (grassland), **geyser pasir** (desert),
**lubang magma** (volcanic). Idle-nya napas + partikel naik, kena → gepeng lalu mental
(`easeOutElastic`), sudah dipakai → redup.

```
40  75  158  195  256  308  392  460  590  690  790  950  1080  1250  1420  1590  1790  2050  2290  2590
```

**Pad cuma nyala kalau pod DATANG SAMBIL NYELAM** (`pod.dive` aktif, atau masih bawa
`diveVy` ≥ 180 dari busur yang sama). Ini keputusan desain, bukan tuning: versi pertama
nyala buat sentuhan apa pun, dan lompatan-lompatan rendah alami **nyapu semua pad** — Lv3
PERFECT tanpa input jadi 755 m (dari 221), dan sekali kena satu pad, pod yang udah cepet
nyapu 6 pad berikutnya sendiri. "Tanpa input ≈ prototype lama" bakal bohong dan BOOST! gak
ada artinya. Sekarang tanpa input **identik sampai desimal** di semua level. Pad yang
disentuh tanpa nyelam jadi **dud**: gepeng tipis, bunyi klik, teks `DIVE INTO IT!` (3× per
sesi) — aturannya ngajarin dirinya sendiri.

Impuls: `vy = 450 × power + 8% × vy masuk (cap 900)`, `vx × 1,04`. Chain: pad kedua dalam
2,5 detik = `CHAIN ×2`, +5% retensi `vx` per step, **cap ×3**. Kena pad pas OVERDRIVE nambah
0,7 detik overdrive (visual doang) plus ring ketiga dan flash. Juice-nya berjenjang:
pantulan biasa < pantulan keras < BOOST < CHAIN < CHAIN pas OVERDRIVE.

Kamera: look-ahead sekarang **42% dari lebar yang kelihatan** (bukan piksel tetap), jadi
di zoom berapa pun pod duduk ~30% dari kiri; floor zoom 0,38 → 0,34; pas nyelam framing
geser 26/48 px ke depan/bawah, di-damp.

### Angka terukur (`node tools/flight-sim.mjs`, Lv1 kecuali disebut)

> **Tabel ini kadaluarsa.** Diukur di peta lama (site rapat, chain tanpa decay). Peta-nya
> di-stretch dan chain-nya dikasih decay di hari yang sama — angka yang berlaku ada di
> bagian **"Peta di-stretch"** paling bawah.

| | tanpa input | dengan dive |
|---|---|---|
| PERFECT | 128 m, IN wreck (sama kayak sebelum revisi) | tahan di 20–32 m → BOOST di 40 → **138–172 m** (+10..+44; +10 kalau nyangkut friksi wreck) |
| PERFECT, 2 dive | — | tahan lagi di 54–66 m → CHAIN ×2 di 75 → **207–214 m**: `5m SHORT!` / `3m SHORT!` / IN crater |
| GOOD | 55 m, IN crate | tahan di 32–42 m → 90 m IN crystal (+36) |
| GREAT | 67 m, 1m TOO FAR crate | tahan di 30–42 m → 96–102 m IN crystal (+31..+35) |
| PERFECT, tahan telat (54–92 m) | — | mendarat IN crystal (nyelam buat *milih* site) |
| Lv2 PERFECT | 142 m, 1m TOO FAR wreck | tahan di 126 m → IN wreck; dive di 14–24 → 173 m |
| Lv10 PERFECT | 892 m | nyelam ke pad awal = **-200..-500 m** (buang busur pertama); cuma dive telat yang untung |
| pump (tahan tiap turun) | — | Lv1 108 m, Lv10 253 m, Lv20 527 m — lebih pendek dari natural |
| tahan terus | — | 31 m |

Jadi urutan emosinya beneran ada di Lv1: PERFECT → pegas kelihatan di bawah puncak busur →
tahan → BOOST! → tahan lagi di puncak busur boost → CHAIN ×2! → **"5m SHORT!" METEOR
CRATER**. Dan di Lv10 "jangan nyelam" itu keputusan yang bener — bukan semua pad layak.

Jendela timing dive pertama ≈ ±6 m ≈ 0,2 detik di kecepatan Lv1. Hit-circle pad = radius
pad (2,5–4,2 m) + radius pod, pusatnya 8 px di atas tanah; dicek tiap substep (≤ 6 px), jadi
pod 4243 px/s pun gak nembus (dites).

### Konstanta (`CFG`, js/world.js)

| | nilai | kenapa |
|---|---|---|
| `FLIGHT_DIVE_ACCEL` | 2600 | ~2,1g: kebaca "ngedorong", masih bisa dibidik |
| `FLIGHT_DIVE_MAX_VY` | 1500 | dive berhenti nambah di atas ini; level tinggi gak jadi peluru |
| `FLIGHT_DIVE_VX_DRAG` | 0,3 /s | harga kecil, bukan rem |
| `BOOST_VY` | 450 | 540 ngasih +79 m dari satu pad (separuh run) |
| `BOOST_VY_IN` / `_CAP` | 0,08 / 900 | nyelam mantap lebih tinggi dari nyerempet |
| `BOOST_VX_KEEP` | 1,04 | pegasnya dorong maju dikit; <1 kebaca kayak tembok |
| `BOOST_DIVE_MIN` | 180 | ≈ 0,07 detik tahanan buat "dihitung nyelam" |
| `BOOST_MIN_SPEED` | 120 | pod merayap gak nyalain pad — near-miss tetap jujur |
| `BOOST_CHAIN_T` | 2,5 s | satu busur boost + satu pantulan ≈ 1,5 s |
| `BOOST_CHAIN_VX` / `_MAX` | 0,05 / 3 | cap keras: gak pernah terbang selamanya |
| `OVERDRIVE_BOOST` | 0,7 s | visual doang |

Save nambah dua flag aditif (`tutDive`, `tutBoost`) buat hint sekali-seumur-hidup
`HOLD TO DIVE` dan `HIT BOOSTERS TO GO FARTHER`; save lama dapet `false` dari merge.

### Tiga hal yang ketangkep cuma karena dites

1. **Pad nyala tanpa nyelam** (di atas) — ketahuan dari sweep headless, bukan dari mata.
2. **Callback `(b) => onBooster(b)` ngebuang argumen `dud`.** Di Node simulasinya lolos
   (callback-nya langsung), di browser tiap dud dihitung BOOST! penuh — ring, teks, chain —
   tanpa fisika. Ketangkep karena run tanpa input di browser ngelapor `boosts: 1`.
3. **Nahan lewat BOOST! ngebunuh run** (di atas).

### Yang masih perlu dinilai jujur

- Satu boost di kasus terbaik +44 m, masih di atas target +15–30. Angkanya gampang
  digeser (`BOOST_VY`), tapi kalau diturunin, chain ke pad 75 dari pad 40 ikut nyusut.
- Pad 75 duduk di pita near-miss crystal (78–86 gak kena, tapi visualnya deket tiang).
  Gate "harus nyelam" bikin gelinding near-miss gak kesenggol, tapi tetap perlu dilihat di
  tangan.
- Di Lv10 pod nyenggol 5–6 pad per run tanpa nyelam → 5–6 bunyi dud. Udah pelan, tapi
  bisa jadi berisik.
- Semua angka di atas dari headless + event sintetis di Chrome; jendela 0,2 detik itu
  belum dites jempol beneran di HP.

### Saran pass tuning berikutnya (belum diimplementasi)

- **Coba `BOOST_VY` 400–420** kalau +44 kerasa "gratis"; ukur lagi chain 40→75.
- **Tahan pas gelinding = rem** (friksi ekstra). Satu kontrol yang sama, dan itu jawaban
  langsung buat "Ancient Mine itu lotre" — sekarang dive cuma ngatur *kapan turun*.
- **Indikator titik jatuh** tipis pas nahan (garis putus-putus ke tanah) — kalau jendela
  0,2 detik ternyata terlalu sempit di HP. Bukan auto-aim, cuma baca.
- **Pad power per level**, bukan per posisi: di Lv3–5 pad 158/195/256 ngasih +60..+110 m,
  di Lv10 pad yang sama nyaris gak berarti.
- Dud di kecepatan tinggi: skip bunyi kalau `speed > ~1500`, sisain gepengnya aja.
- Lihat apakah `HOLD TO DIVE` perlu muncul lagi di run 2–3 buat yang gak nyoba di run 1.

Alat: `node tools/flight-sim.mjs baseline | pump | path <lv> <rating> | sweep <lv> <rating>
<bounceLv> <dariM> <sampaiM> | chain <lv> <rating> <bounceLv> <tahanPertamaM> <dariM> <sampaiM>`
— ngeload `utils/world/player` asli ke `vm`, nol dependency.


---

## Peta di-stretch (11 Sep 2026) — dari feedback *"terlalu gampang, jaraknya harusnya lebih jauh"*

Irvan main sekali abis revisi dive/booster dan langsung bilang kegampangan. Diukur, dia bener,
dan penyebabnya dua hal yang cuma keliatan dari simulasi:

**1. Peta-nya ditulis buat band yang udah gak ada.** 9 site bernama ditaruh waktu fase terbang
belum ada input sama sekali, jadi rentangnya 58–1160m. Dengan dive + booster, pemain Lv1 yang
main bagus nyampe **302m** — lewat 4 dari 9 site di run pertama, dan **Ancient Mine kebuka di
Lv3**. Seluruh peta abis di Lv7.

**2. Chain-nya numpuk tanpa batas.** Tiap pad ngasih impuls tetap 450 px/s ke atas, sementara
luncuran Lv1 cuma 747 px/s. Jadi tiap pad itu ~60% peluncuran gratis, tiap kali, gak peduli
udah pad ke berapa. Chain ×4 di Lv1 = **486m**, 4× run natural — persis yang dulu ditulis
"jangan sampai satu booster ngedobelin run".

### Yang diubah

**Site di-stretch progresif, bukan dikali rata.** SUPPLY CRATE sengaja **tetap di 58m**: run
pertama tetap harus bayar, dan seluruh tangga Lv1 gantung di situ.

| | dulu | sekarang | |
|---|---|---|---|
| SUPPLY CRATE | 58 | **58** | tetap — hook run pertama |
| CRYSTAL PIT | 96 | **126** | Lv1 PERFECT tanpa input |
| RUSTED EXCAVATOR | 132 | **170** | Lv1 PERFECT + 1 boost |
| STONE ARCH *(decor)* | 172 | 230 | |
| METEOR CRATER | 224 | **296** | Lv3 |
| OLD BRIDGE *(decor)* | 272 | 385 | |
| GIANT SKELETON | 344 | **495** | Lv5 |
| OBELISK *(decor)* | 430 | 600 | |
| ANCIENT MINE | 512,5 | **712,5** | Lv7–10 (dulu Lv3) |
| ABANDONED RIG | 664 | **985** | Lv10 tanpa input |
| LAVA TUBE | 884 | **1480** | Lv10–14 |
| SIGNAL TOWER | 1160 | **2180** | endgame |

Biome ikut di-stretch biar tiap site tetap kebagian tanah yang sama: grassland `<400`, desert
`400–1100`, volcanic `1100+` (dulu 300/700). `WORLD_M` 3000 → **4200**, soalnya run maksimal
terukur 2903m dan kehabisan terrain kebacanya kayak bug. Peredaman amplitudo terrain diperpanjang
320m → **400m**: jaminan "timing sama = jarak sama persis" harus nutupin seluruh Lv1, dan Lv1
sekarang nyampe 300m+.

**Chain dikasih decay.** `BOOST_CHAIN_DECAY` 0,72 — tiap pad berikutnya dalam satu chain
ngelempar **lebih rendah** dari sebelumnya (450 → 324 → 233 → 202 di power 1). Retensi maju
tetap **naik** (`BOOST_CHAIN_VX`), jadi chain panjang kebacanya **memipih jadi luncuran datar
yang cepet**, bukan tangga yang makin tinggi. Masih hadiah, tapi bukan peluncuran kedua.

`BOOST_CHAIN_DECAY_MIN` 0,45 itu lantainya. Tanpa lantai, link ke-4 cuma ngelempar 168 px/s
lawan dive 400–700 px/s — pad-nya **keliatan gagal** ngelempar pod sementara banner-nya teriak
CHAIN ×4. Hadiah yang keliatan kayak kegagalan itu lebih buruk daripada gak ada hadiah.

**25 pad** (dari 20), digeser biar gak ada yang nabrak zona pendaratan baru, pita near-miss,
rambu 100m, atau art decor. `b040` dan `b079` gak dipindah jauh: fisika terbangnya gak berubah,
jadi busur Lv1 yang dulu dipakai buat nyetel mereka masih persis di situ. `b148` nyelip di celah
9m antara pita near-miss CRYSTAL PIT dan RUSTED EXCAVATOR — itu link ketiga chain Lv1 dan
satu-satunya tempat yang disisain peta baru.

### Tangga Lv1 — satu level, lima hasil berbeda

> Angka di blok ini diukur **sebelum** ground decay dipasang. Yang berlaku sekarang ada
> di bagian **"Tanah makin lama makin lemah"** paling bawah.

```
WEAK        35m   —
GOOD        55m   IN SUPPLY CRATE          <- run pertama tetap dibayar
GREAT       68m   2m TOO FAR! SUPPLY CRATE <- near-miss ngajarin timing
PERFECT    123m   IN CRYSTAL PIT           <- timing sempurna = hadiah lain
+ 1 dive   163m   IN RUSTED EXCAVATOR      <- mystery kebuka pakai skill
+ 4 dives  333m   lewat METEOR CRATER      <- ceiling: jauh, tapi gak dapet apa-apa
```

Baris terakhir itu yang paling penting: di Lv1 pemain **gak bisa mendarat** di METEOR CRATER —
kecepatannya kelewat buat berhenti di zona 284–308m. Jadi ada pilihan beneran antara *jarak
maksimal* dan *mendarat di site*, dan crater jadi alasan buat naik level, bukan hadiah gratis.

### Progresi sesudahnya (`node tools/flight-sim.mjs reach`)

> Sama, tabel ini pra-decay. Yang terbaru ada di bagian paling bawah.

| lv | tanpa input | main bagus | peta kepake |
|---|---|---|---|
| 1 | 123m IN crystal | 333m | 2 / 4 dari 9 |
| 3 | 166m IN wreck | 378m | 3 / 4 |
| 5 | 306m IN crater | 648m | 4 / 5 |
| 7 | 379m | 547m | 4 / 5 |
| 10 | 973m IN rig | 1557m | 7 / 8 |
| 20 | 1122m | 2903m | 7 / 9 |

Bandingin sama sebelum: Lv1 dulu udah 4 site, sekarang 4 site butuh chain sempurna dan tetep
gak dapet hadiahnya. Ancient Mine geser dari Lv3 ke Lv7–10.

### Yang dites

- **Tanpa input masih identik** di semua level sebelum/sesudah decay chain — decay cuma nyentuh
  pad ke-2 dan seterusnya.
- **Pumping tetap mati**: tahan-tiap-turun ngasih 127m di Lv1 (natural 123m), dan **jauh lebih
  pendek** di semua level lain (Lv10 391m lawan 973m). Tahan terus = 31m.
- **Bentuk return callback**: `onBooster` sekarang balikin `{ vxBonus, step }`, bukan angka.
  Ini persis kelas bug yang kemarin lolos dari simulasi, jadi diverifikasi langsung di Chrome
  pakai instrumentasi `Pod.prototype.hitBooster` — kebaca `520 → 395 → 243 → 211`, cocok sama
  rumusnya termasuk lantai 0,45 di step 3.
- **Sapuan seluruh dunia** 0–4200m: `yAt` finite di mana-mana, palette resolve, tiap pad dan
  site duduk di tanah beneran, heightfield 2804 entri.
- `node tools/check-layout.mjs` lolos: nol pad di dalam zona/pita near-miss/rambu/decor.

### Alat

```bash
node tools/flight-sim.mjs reach      # progresi per level + tangga Lv1
node tools/flight-sim.mjs baseline   # jarak tanpa input (harus stabil tiap ngubah fisika)
node tools/flight-sim.mjs pump       # jaminan anti-pumping
node tools/check-layout.mjs          # validasi penempatan site & pad (exit 1 kalau nabrak)
```

`check-layout.mjs` itu baru. Dia yang nangkep `b075` nempel 0,5m di pita near-miss SUPPLY CRATE
waktu pertama ditaruh — geser ke 79m. Jalanin tiap abis mindahin site atau pad.

### Yang masih perlu dinilai jujur

- **Lv5 main bagus 648m, Lv7 cuma 547m.** Planner-nya greedy jadi bisa nyangkut, tapi bisa jadi
  emang ada lubang di persebaran pad antara 500–750m.
- **METEOR CRATER gak bisa didarati di Lv1** itu disengaja, tapi belum dites ke orang. Bisa jadi
  kebacanya "kok gw gak pernah bisa masuk situ" alih-alih "gw butuh naik level".
- Tangga Lv1 yang rapi itu hasil nyetel ke angka simulasi yang presisi. Pemain beneran gak bakal
  kena persis 55/68/123m, jadi yang dijamin cuma urutannya, bukan angkanya.
- Site jauh (LAVA TUBE 1480, SIGNAL TOWER 2180) belum pernah didarati di tes mana pun — cuma
  dilewatin. Zona-nya dilebarin (16/20m) tapi itu tebakan, bukan ukuran.


---

## Sikap mendarat (11 Sep 2026) — dari feedback *"aneh gak sih mantul-mantul padahal drill-nya lancip"*

Diukur, dan masalahnya lebih sempit tapi lebih dalam dari kedengarannya.

**Yang aneh bukan "mantul", tapi "mantul dari ujung lancip", dan cuma di tumbukan pertama.**

| tumbukan | sudut hidung (0 = rata, +90 = nancep tegak) |
|---|---|
| pertama | +43° … +49° |
| kedua | +10° … +26° |
| sisanya | +2° … +9° |

Mantulan kedua ke atas udah nyaris rata, itu sebenernya udah kebaca bener: pod nyerempet
pakai perut kayak batu loncat. Yang rusak cuma tumbukan pertama, dan sialnya itu momen paling
banyak juice-nya dalam satu run.

**Temuan yang lebih penting: dua kejadian berlawanan bentuknya identik.** Tumbukan pertama
yang natural itu +43°. Nyelam ke tanah itu +48°. Sama persis di mata, padahal yang satu mental
tinggi dan yang satu momentumnya habis. Aturan yang udah jalan di fisika sama sekali gak punya
wujud di layar.

### Sikap hidung dijadiin tata bahasa visual

Tiga aturan yang **udah ada di kode**, sekarang masing-masing punya pose sendiri:

| situasi | pose | hasil (gak berubah) |
|---|---|---|
| gak nyelam | **flare**, hidung dikunci maks **13°**, mendarat di skid plate | mantul |
| nyelam ke tanah | bit memimpin, dikunci min **40°**, lalu **nancep** | momentum habis |
| nyelam ke pad | bit memimpin, nusuk pegasnya | BOOST |

`FLARE_MAX` 13° itu bukan angka selera. Skid plate adalah titik terendah siluet sampai **33°**,
di atas itu ujung bor yang terendah. 13° bikin tiap pendaratan flare dijamin mendarat di pelat,
bukan di mata bor. Yang nyelam dikunci 40°, jauh di sisi seberang ambang itu.

**`DIVE_ANGLE` 40° itu perbaikan yang cuma ketemu karena diukur per level.** Sikap hidung dulu
murni `atan2(vy, vx)`, dan itu ambruk di kecepatan tinggi: nyelam sekenceng apa pun di power 6
cuma ngasih **12°**, soalnya `vx` jauh lebih gede dari `vy`. Jadi di atas level-level awal,
"nyelam" dan "flare" keliatan sama aja. Setelah dua-duanya dikunci ke arah berlawanan, jaraknya
**46–50° di semua level** (1, 3, 6, 10, 20), bukan 0–6° kayak sebelumnya.

**Skid plate** ditambahin di perut pod. Tanpa itu, flare-nya cuma keliatan kayak pod mendongak
tanpa alasan. Sekarang ada benda yang jelas dibikin buat nahan pendaratan.

**Nancep** dipicu tepat waktu `diveVy` dicopot dan ternyata gak nyisa apa-apa buat mantul, alias
**nyelam-lah yang naruh pod di tanah itu**, bukan jatuh. Presentasinya sengaja kebalikan dari
mantulan: gak ada ring, tanah nyembur ke **belakang** bukan ke atas, gak ada hitungan BOUNCE,
dan bunyinya crunch yang mati bukan thump yang berdenting. Art-nya digeser 15px sepanjang
sumbunya sendiri biar mata bornya beneran masuk tanah, terus badannya jungkir di atas ujung itu
sampai rebah ngikutin lereng.

**Bor berhenti muter di udara.** Dulu dia muter sampai 26 rad/s sepanjang terbang, yang
nyiratin dia bagian yang lagi kerja. Sekarang idle 2,5 rad/s, naik ke 20 pas pemain nahan buat
nyelam, dan full pas transisi ke bawah tanah. Bor muter = mode ngebor.

### Semua ini kosmetik, dan itu diverifikasi

`pod.angle` gak pernah dibaca fisika terbang. `plantT` cuma nyentuh sudut gambar. Jadi jarak
tempuh harus identik, dan emang identik digit per digit di seluruh tabel `baseline` sebelum
dan sesudah. Yang berubah cuma apa yang kelihatan.

### Konstanta baru

| | nilai | kenapa |
|---|---|---|
| `FLARE_T` | 0,17 s | jendela sebelum kontak buat ngangkat hidung |
| `FLARE_MAX` | 0,22 rad (13°) | di bawah ambang geometri 33° |
| `FLARE_LAMBDA` | 18 | di 9 (rate normal) hidungnya cuma nyampe 22°, masih kebaca nusuk |
| `DIVE_ANGLE` | 0,70 rad (40°) | nahan sikap nyelam pas `atan2` ambruk di kecepatan tinggi |
| `PLANT_T` | 0,34 s | lama bit ketanam |
| `PLANT_SINK` | 15 px | geseran art biar ujungnya beneran di dalam tanah |

### Tiga hal yang ketangkep pas ngetes, dua di antaranya salah gw sendiri

1. **Blend flare ketumpuk `angleDamp`.** Target-nya di-ramp DAN di-damp, jadi double-smooth dan
   hidungnya cuma nyampe 22° pas kontak. Dihapus ramp-nya, langsung nyampe 13°.
2. **`atan2` ambruk di kecepatan tinggi** (di atas) — ini yang paling penting, dan cuma
   keliatan karena ngukur sudut di beberapa level power, bukan cuma Lv1.
3. Dua tes pertama gw sendiri yang cacat: sekali nyelam dari ketinggian 24px doang, sekali
   kondisi dive-nya mati justru pas mau nyentuh tanah. Dua-duanya sempat kebaca kayak bug flare.

### Yang masih perlu dinilai jujur

- **Apakah "nancep terus mati" kerasa adil atau kerasa hukuman.** Sekarang sebabnya kelihatan,
  tapi kelihatan itu bisa bikin lebih nyebelin, bukan lebih enak. Ini yang paling perlu dites
  ke tangan, bukan ke simulasi.
- Nancep sengaja **gak dikasih teks**. Kalau ternyata masih gak kebaca, pola hint sekali-pakai
  kayak `DIVE INTO IT!` gampang dipasang.
- Flare bikin pod mendongak di tiap pendaratan, termasuk pantulan kecil di akhir run yang dulu
  udah rata sendiri. Belum jelas apakah itu kerasa hidup atau kerasa gelisah.
- Skid plate belum dites di palet OVERDRIVE dalam gerakan, cuma di pose diam.


---

## Eksperimen: "Ground ends run" (toggle debug, default OFF)

> Toggle terpisah ini sudah **dilebur** jadi salah satu pilihan di pemilih SURFACE
> MODE (mode `PLANT`). Isi analisisnya masih berlaku.

Usulan dari diskusi desain: **"The drill does not bounce off the ground. The WORLD bounces
the drill."** Tanah gak mantulin pod lagi; kena tanah = bor nancep = fase permukaan selesai.
Booster pad jadi satu-satunya cara tetap di udara.

Dipasang di balik toggle `Ground ends run` di panel debug supaya bisa di-A/B langsung, bukan
diperdebatkan. Default OFF, dan `baseline` di mode OFF identik digit per digit sama sebelumnya.

### Yang diukur duluan (simulasi, sebelum dipasang)

| lv | miss semua pad | main sempurna | pad kena / pad terlewati |
|---|---|---|---|
| 1 | 54,6m | 121,1m | 2 / 2 |
| 3 | 77,1m | 135,1m | 1 / 2 |
| 5 | 104,7m | 209,5m | 2 / 3 |
| 10 | 198,8m | 313,8m | 3 / 5 |
| 20 | 458,3m | 764m | 3 / 10 |

**Yang bagus.** Rentang skill-nya sehat, 1,6× sampai 2,2× antara gagal total dan main sempurna.
Stakes-nya jelas: meleset dari pad = run selesai, bukan cuma kehilangan beberapa meter. Dan
near-miss malah jadi **lebih tajam**, karena titik berhentinya ditentukan oleh dive pemain,
bukan oleh ke mana pod kebetulan menggelinding.

**Tiga biayanya.**

1. **Jarak maksimal ambruk 3–5×.** Lv10 dari 972m (tanpa input) jadi 314m (main sempurna).
   Lv20 dari 2903m jadi 764m. Peta yang baru di-stretch harus dipadetin balik, dan LAVA TUBE
   (1480m) sama SIGNAL TOWER (2180m) jadi gak kegapai di level berapa pun.
2. **Kurva kesulitannya kebalik.** Panjang satu busur 55m di Lv1 dan 458m di Lv20, naik 8×.
   Jarak antar pad 40–95m, praktis tetap. Jadi Lv1 dapat **satu** pad per busur (biner, meleset
   sekali mati) sementara Lv20 dapat **enam** tapi cuma bisa pakai satu. Paling susah justru di
   run pertama. Kolom terakhir tabel itu gejalanya: Lv20 cuma makai 3 dari 10 pad yang dilewati.
3. **Yang jadi tidak relevan:** upgrade BOUNCE, layout 25 pad, layout 12 site, decay chain,
   dan kurva ekonomi jarak.

### Yang sudah ada dan tidak perlu dibuat

Beberapa bagian usulannya ternyata sudah jalan: mendarat di site khusus **sudah** mengubah
fase bawah tanah (Ancient Mine kedalaman ×1,5 + rare ×2,2, Crystal Pit rare ×3,2, Meteor
Crater +14m), dan PERFECT **sudah** cuma menambah kecepatan luncur (`BASE_V` ×1,15), bukan
memantulkan pod secara ajaib. Tiga state bor juga sudah dua dari tiga (idle di udara, spin-up
saat menahan dive, penuh saat menembus tanah) — tinggal retract-nya.

### Cara pakai

Tombol ⚙ → `Ground ends run`. Toggle-nya me-restart run supaya satu penerbangan gak pernah
setengah memakai aturan lama dan setengah yang baru. Readout `Zones+Boost` menampilkan mode
yang sedang aktif.

Implementasinya sengaja tipis: tumbukan tanah cuma **menaikkan flag**, dan `endFlight()`
dipanggil setelah `updateFlight` selesai. Mengakhiri run dari dalam loop substep bakal
meninggalkan `updateFlight` mengintegrasikan pod yang state machine-nya sudah pindah tangan.
Flare juga dimatikan di mode ini (`pod.noFlare`), karena di aturan ini bor memang selalu yang
menemui tanah.

### Yang belum bisa dijawab simulator

Angka yang mengecil 3–5× itu **kerasanya** gimana. Di casual game, angka naik terus itu hadiah.
Simulasi bisa bilang rentang skill-nya masih sehat, tapi gak bisa bilang 121m kerasa lebih
hambar dari 333m atau enggak. Itu yang harus diputuskan di tangan.


---

## Tanah makin lama makin lemah (11 Sep 2026) — jalan tengah dari perdebatan "drill kok mantul"

Usulan radikalnya (kena tanah = run selesai) diukur dan tiga biayanya kemahalan: jarak
maksimal ambruk 3–5×, kurva kesulitan kebalik, dan separuh tuning yang ada jadi gak relevan.
Aturan yang dipasang justru jalan tengahnya:

> **Tanah tetap mantulin pod, tapi makin lama makin lemah. Kena booster nge-reset.**

`GROUND_DECAY` 0,75. Restitusi dikali 0,75 tiap mantulan tanah **sejak pad terakhir**, jadi
0,56 → 0,42 → 0,32 → 0,24 di level BOUNCE 1. Begitu pantulannya turun di bawah ambang 62 px/s
yang sudah ada, pod beralih ke mode gelinding sendiri — wind-down-nya berhenti sendiri, gak
perlu aturan tambahan.

**Yang bikin ini nyambung: `hitBooster` nge-set `groundBounces = 0`.** Itu inti desainnya.
Pad bukan cuma nambah ketinggian, dia **mengembalikan kemampuan pod buat mantul**. Jadi
meleset dari pad artinya run lo kelihatan sekarat, dan kena pad artinya run lo hidup lagi.
"The world bounces the drill" dapat, tanpa kematian biner di Lv1.

### Kenapa 0,75, bukan lebih galak

Disapu dari 1,0 turun ke 0,45. Di bawah ~0,75 hukumannya **berhenti tambah galak** sementara
hadiahnya menyusut:

| decay | Lv10 tanpa pad | Lv10 + 1 pad | Lv10 + 2 pad |
|---|---|---|---|
| 0,75 | 505m · 6 mantulan | 832m · **11** | 1002m · **14** |
| 0,62 | 511m · 5 mantulan | 732m · 7 | 852m · 8 |
| 0,50 | 498m · 6 mantulan | 710m · 9 | 839m · 11 |

Kolom pertama praktis sama di ketiganya, decay-nya sudah cukup cepat menumpuk. Yang beda
kolom kedua dan ketiga. Di 0,75 satu pad melempar run dari 6 ke 11 mantulan, dan itu kebaca
mata sebagai "run gw ketolong". Di 0,62 cuma 5 ke 7. Sama hukumannya, jauh lebih jelas
hadiahnya, dan identitas mantul-mantul yang sengaja dibeli di revisi juice September tetap
kejaga.

### Progresi sekarang (`node tools/flight-sim.mjs reach`)

| lv | tanpa input | main bagus | peta kepake |
|---|---|---|---|
| 1 | 118m IN crystal | 348m | 2 / 4 dari 9 |
| 3 | 136m 0m FAR crystal | 332m | 2 / 4 |
| 5 | 258m | 531m | 3 / 5 |
| 7 | 297m IN crater | 569m | 4 / 5 |
| 10 | 505m IN bones | 996m IN rig | 5 / 7 |
| 14 | 770m | 1553m | 6 / 8 |
| 20 | 1025m | 1987m | 7 / 8 |

Peta jadi **lebih awet**: Lv10 sekarang cuma menghabiskan 5 dari 7 site, sebelumnya 7 dari 8.
Jadi ini ikut menjawab keluhan "terlalu gampang" dari arah yang berbeda.

### Tangga Lv1 sekarang

```
WEAK        34m   —
GOOD        54m   IN SUPPLY CRATE
GREAT       62m   IN SUPPLY CRATE
PERFECT    118m   IN CRYSTAL PIT     <- 1,8m di dalam tepi zona
+ 4 dives  348m   lewat METEOR CRATER
```

**Yang hilang: near-miss di GREAT.** Sebelum decay, GREAT mendarat 68m alias 2m lewat dari
SUPPLY CRATE, dan itu momen yang ngajarin near-miss di run pertama. Sekarang GREAT 62m masuk
ke crate, jadi GOOD dan GREAT hasilnya sama. Site-nya **tidak digeser** buat ngejar itu balik:
layout 12 site dan 25 pad sekarang lolos semua aturan penempatan, dan menggeser crate demi
satu kebetulan bakal nabrak pita near-miss pad `b040`. Gantinya, Lv3 tanpa input sekarang
mendarat 136m = **0m FAR CRYSTAL PIT**, near-miss paling tipis yang mungkin.

PERFECT Lv1 mendarat 1,8m di dalam tepi zona CRYSTAL PIT. Tipis, tapi game-nya deterministik
jadi stabil, dan sejujurnya "nyaris gak masuk" itu lebih menegangkan daripada mendarat di
tengah.

### Yang dicek

- **Decay jalan di browser**, bukan cuma di simulasi: restitusi terbaca 0,56 → 0,42 → 0,32.
- **Reset pad jalan**: log `PAD b040 gb->0` lalu mantulan mulai dari gb1 lagi.
- **Anti-pumping masih mati**: tahan-tiap-turun tetap lebih pendek dari natural di semua level
  kecuali Lv1 (+9m karena nyenggol pad). Tahan terus = 31m.
- Toggle `Ground ends run` yang dipasang sebelumnya **tetap ada** di panel debug, jadi tiga
  aturan (mantul penuh / mantul meluruh / tanah mematikan) masih bisa di-A/B bertiga.

### Yang masih perlu dinilai jujur

- Di Lv1 decay-nya nyaris gak kerasa (4 mantulan jadi 3), karena run Lv1 didominasi satu busur
  besar. Mekanik ini baru berarti dari Lv3–5 ke atas. Belum jelas itu progresi yang bagus atau
  malah bikin early game terasa beda aturan.
- Revisi juice September sempat mencatat 3 mantulan **terasa mati**, dan Lv1 tanpa pad sekarang
  persis 3. Bedanya sekarang itu hukuman karena meleset, bukan default. Itu asumsi yang harus
  dites ke tangan.
- Upgrade BOUNCE sekarang artinya berubah: bukan "seberapa jauh tiap mantulan", tapi "berapa
  lama pod sanggup bertahan tanpa pad". Nama dan deskripsinya belum diubah.


---

## Pemilih SURFACE MODE (11 Sep 2026) — tiga aturan hidup bareng, default balik ke BOUNCE

Setelah tiga aturan permukaan lahir dari satu diskusi, dua toggle terpisah (`Ground ends run`
dan konstanta `GROUND_DECAY` yang gak punya UI) mulai bisa saling tabrakan. Dilebur jadi satu
tombol siklus di ⚙, dan **default-nya dibalikin ke `BOUNCE`**.

| mode | aturan | Lv1 | Lv10 | Lv20 |
|---|---|---|---|---|
| **BOUNCE** *(default)* | tanah mantulin penuh, selamanya | 123m · 4 mantulan | 973m · 16 | 1122m · 15 |
| DECAY | tiap mantulan meluruh ×0,75, pad nge-reset | 118m · 3 | 505m · 6 | 1025m · 4 |
| PLANT | sekali kena tanah, run selesai | 55m · 1 | 199m · 1 | 458m · 1 |

`node tools/flight-sim.mjs modes` buat regenerasi tabel ini.

**Kenapa BOUNCE yang jadi default.** Seluruh tuning yang ada disandarkan ke dia: posisi 12
site, 25 pad, peredaman amplitudo terrain, dan terutama tangga Lv1. Dengan BOUNCE tangga itu
utuh lagi, termasuk momen yang hilang waktu decay jadi default:

```
WEAK        35m   —
GOOD        55m   IN SUPPLY CRATE
GREAT       68m   2m TOO FAR! SUPPLY CRATE   <- near-miss balik
PERFECT    123m   IN CRYSTAL PIT
+ 4 dives  333m   lewat METEOR CRATER
```

Dan cuma di mode ini upgrade **BOUNCE** punya arti. Di DECAY dia cuma nunda yang gak
terhindarkan; di PLANT dia mati total.

Pilihannya disimpan di save (`surfaceMode`), jadi play-test di HP selamat dari reload.
`Reset Progress` ngembaliin ke `bounce`. Ganti mode selalu me-restart run, biar satu
penerbangan gak pernah setengah main pakai aturan lama.

### Bug yang ketemu gara-gara tes ini: `dt` bisa negatif

`Game.loop` cuma ngebatesin `dt` dari atas:

```js
dt = Math.min(dt, 0.05);      // sebelum
dt = U.clamp(dt, 0, 0.05);    // sesudah
```

Batas bawahnya sama pentingnya. **Semua** nilai yang dihaluskan di game ini lewat `U.damp`,
dan `damp` dengan `dt` negatif menghasilkan faktor blend negatif — dia **meng-ekstrapolasi
menjauh** dari target, bukan mendekat. Diukur: satu frame dengan timestamp mundur 3 detik
melempar `cam.x` dari 200 ke **-813569**, layar jadi kosong total.

Dengan `requestAnimationFrame` normal timestamp-nya monoton, jadi ini gak pernah kejadian di
permainan biasa. Tapi tab HP yang di-background dan penyesuaian jam bisa memicunya, dan
gejalanya (layar biru kosong, game seolah mati) nyaris mustahil didiagnosis dari laporan
pemain. Ketemu karena harness tes headless-nya sendiri ngasih timestamp mundur.


---

## Loop meteor (11 Sep 2026) — bor gak mantul, bor NANCEP

Fantasi intinya diganti. Karakternya bor berat berujung tajam; kena tanah terus mantul-mantul
kayak bola itu bentrok sama bahasa visualnya sendiri. Sekarang:

**LAUNCH → busur tinggi → JATUH → HANTAM → penetrasi otomatis → energi habis → NGEBOR MANUAL**

Ini jadi `SURFACE: IMPACT`, mode **default**. Tiga mode lama (BOUNCE / DECAY / PLANT) masih
ada di settings buat perbandingan, tapi bukan lagi jalur utama.

### Temuan yang nentuin sudut luncur

Sebelum nulis satu baris pun, sudutnya disapu dulu. Hasilnya bikin keputusannya gampang:

| sudut | jangkauan | apex | waktu di udara | sudut datang | **KE saat tumbukan** |
|---|---|---|---|---|---|
| 52° | 55m | 18m | 0,95s | 53° | **288k** |
| 60° | 49m | 21m | 1,05s | 60° | **288k** |
| 65° | 43m | 23m | 1,08s | 65° | **279k** |

**Energi tumbukan praktis gak dipengaruhi sudut.** Ketinggian cuma nuker KE jadi PE dan balik
lagi, persis seperti seharusnya. Jadi sudut itu murni pilihan soal *bentuk busur*, dan gak
pernah bisa dipakai nyelundupin tenaga tambahan. Dipilih **60°**: apex +17%, waktu di udara
+11%, jangkauan cuma -11%, dan pod datang di 60° sehingga kecepatan vertikalnya 1,7× horizontal.

`IMPACT_BASE_V` dinaikin 650 → **1000** murni buat ngebalikin jarak yang hilang karena mantulan
dihapus: satu busur sekarang harus nutupin apa yang dulu dikerjain empat mantulan, biar peta
site dan ambang biome tetap berarti. Lv1 PERFECT mendarat di **114m**, apex **50m**, **1,58 detik**
di udara.

### Model energi

```
KE = 1/2 · m · v²          PE = m · g · tinggi di atas tanah          ME = KE + PE
impactEnergy = (KE saat tumbukan / IMPACT_ENERGY_SCALE) · impactEfficiency
```

Dinormalisasi, bukan joule beneran — semua yang di hilir cuma pakai *rasio*. `IMPACT_ENERGY_SCALE`
dipatok ke KE tumbukan Lv1 PERFECT, jadi angka itu kebaca **1.0**. Drift ME sepanjang busur
diukur **1,2%** (sisa langkah integrasi, bukan kebocoran).

Penetrasi: tiap meter tanah nggerogotin budget, dan kecepatan turun dari sisa energi.

```
resist   = SOIL_RESISTANCE · biome · (1 + kedalaman · SOIL_HARDEN_PER_M)
v        = PEN_SPEED_SCALE · √E          (bentuk yang sama dengan E = 1/2mv²)
E       -= resist · meter
```

Karena tanah makin dalam makin keras, budget **selalu** habis. Arah tembusnya mulai dari sudut
datang lalu dibelokin ke tegak lurus (`PEN_TURN`) — tanah menahan gerak menyamping jauh lebih
kuat, dan itu sekalian naruh hidung bor menghadap ke bawah pas kendali diserahkan.

### Kedalaman tumbukan + kedalaman manual itu DUA hal

```
IMPACT DEPTH  = gratis, hasil hantaman
MANUAL DEPTH  = jangkauan stat DRILL, dihitung DARI titik bor berhenti
```

`World.setFloor()` dipanggil begitu penetrasi berhenti: lantai dipasang tepat `manualDepth`
di bawah titik berhenti beneran. Tanpa itu, ladang mineral digenerate pakai kedalaman
**prediksi** (sengaja dilebihin, karena batu dan radius pod bikin berhenti lebih dangkal) dan
selisihnya bakal kekasih gratis sebagai kedalaman manual ekstra.

Jadi **luncuran lebih bagus = mulai lebih dalam = mineral lebih langka**. Itu sambungan yang
paling penting dari revisi ini: fase permukaan sekarang langsung mbayarin fase bawah tanah.

### Angka Lv1 (`node tools/flight-sim.mjs impact`)

| timing | jangkauan | apex | udara | kecepatan datang | energi | **IMPACT DEPTH** | target |
|---|---|---|---|---|---|---|---|
| WEAK | 32m | 15m | 0,85s | 604 px/s | 0,28 | **5,9m** | 3–6 ✓ |
| GOOD | 52m | 22m | 1,08s | 787 px/s | 0,46 | **12,0m** | 6–12 ✓ |
| GREAT | 66m | 28m | 1,22s | 884 px/s | 0,59 | **15,0m** | 12–18 ✓ |
| PERFECT | 114m | 50m | 1,58s | 1140 px/s | 0,98 | **24,5m** | 18–25 ✓ |

Keempatnya masuk band yang diminta. Progresi upgrade (PERFECT, power/impact):

| lv | jangkauan | biome | energi | impact depth | + manual | total |
|---|---|---|---|---|---|---|
| 1/1 | 114m | grass | 0,98 | 24,5m | 38m | 62,5m |
| 3/3 | 165m | grass | 1,78 | 44,7m | 38m | 82,7m |
| 5/5 | 226m | grass | 2,98 | 68,6m | 38m | 106,6m |
| 10/8 | 413m | desert | 6,65 | 133,4m | 38m | 171,4m |
| 20/12 | 962m | desert | 19,49 | 280,6m | 38m | 318,6m |

### Konstanta

| | nilai | |
|---|---|---|
| `IMPACT_ANGLE` | 60° | bentuk busur, bukan tenaga |
| `IMPACT_BASE_V` | 1000 | ganti jarak yang hilang karena mantulan dihapus |
| `POD_MASS` | 1 | ternormalisasi |
| `IMPACT_ENERGY_SCALE` | 660000 | KE tumbukan Lv1 PERFECT = 1.0 |
| `IMPACT_EFF_BASE` / `_PER` | 1,0 / 0,12 | stat IMPACT |
| `SOIL_RESISTANCE` | 0,028 | energi per meter |
| `SOIL_HARDEN_PER_M` | 0,012 | jaminan penetrasi selalu berhenti |
| `PEN_SPEED_SCALE` | 640 | v = 640·√E |
| `PEN_MIN/MAX_SPEED` | 60 / 1250 | |
| `PEN_TURN` | 2,4 | belok ke tegak |
| `IMPACT_STOP_T` | 0,32s | jeda sebelum kendali |
| `IMPACT_MIN_SPEED` | 150 | di bawah ini itu mendarat, bukan menghantam |

Resistensi per biome: grassland 1,00 · desert 0,88 (pasir lebih empuk) · volcanic 1,35
(batu keras, plus percikan bara).

### BOUNCE → IMPACT, save lama aman

Stat `BOUNCE` gak masuk akal lagi. Labelnya jadi **IMPACT** (efisiensi konversi energi jadi
penetrasi), tapi **kunci save-nya tetap `bounce`** — ngeganti kunci bakal ngebuang level
upgrade semua pemain yang ada demi sekadar ganti nama di prototype.

Migrasi sekali jalan lewat flag `impactV2`. Ada satu jebakan yang sempat kena:
`Object.assign({}, DEF, saved)` bikin nilai DEF *bertahan* kalau save-nya gak punya kunci itu
— jadi `impactV2: true` di DEF bikin tiap save lama keliatan "udah dimigrasi" dan diam-diam
ketinggal di loop lama. Default-nya harus `false`. Dites pakai save palsu: koin, power, level
bounce, best, dan discovery semuanya utuh, mode pindah ke impact.

### Yang dites

`charge → flying → penetrate → drill → result` jalan penuh. Tiga mode lama juga masih jalan
penuh (`charge → flying → settle → dive → drill → result`) dan angkanya gak bergeser. Setiran
kiri/kanan, chain mineral, batu, storage, near-miss, dan site bonus semuanya normal sesudah
tumbukan.

Mineral yang ketabrak saat penetrasi diambil otomatis — `CRACK! + GOLD` — tapi **gak pernah
nambah chain**. Penetrasi itu gak disetir, jadi ngasih dia hadiah setara nyetir bakal
ngerusak inti fase ngebor. Nilainya face value, dan pod yang penuh ninggalin sisanya.

### Yang masih perlu dinilai jujur

- **Di level tinggi, fase manual jadi kecil banget.** Lv20 dapat 280m gratis dari tumbukan
  lawan 38m manual (di DRILL Lv1). Pemain beneran bakal naikin DRILL juga, tapi rasionya tetap
  condong ke tumbukan. Ini yang paling perlu diukur ulang setelah dimainin.
- **GREAT ke PERFECT lompatannya jauh** (15m → 24,5m). Itu warisan kurva timing lama yang
  sengaja dibikin tajam (`mult` 0,87 vs 1,15); bukan sesuatu yang dibikin di revisi ini, tapi
  di model energi efeknya jadi kuadrat.
- **Peta site sekarang agak ketinggalan.** Jarak Lv1 PERFECT (114m) kebetulan masih dekat
  angka lama, tapi seluruh tabel site disetel buat game yang mantul. Sengaja gak disentuh —
  spec-nya bilang site itu sekunder di revisi ini.
- Kawahnya cuma nge-dent garis terrain yang **digambar**, bukan `yAt()`. Jadi dia murni visual
  dan gak akan pernah ikut ngubah fisika. Cukup buat prototype, tapi jangan disangka destruksi
  beneran.
- `predictDepth` selalu lebih dalam dari hasil sebenarnya (30m vs 24,5m di Lv1 PERFECT) karena
  batu dan radius pod. Itu **disengaja** dan aman (ladangnya digenerate agak berlebih), bukan
  bug — tapi jangan dipakai buat nampilin angka ke pemain.


---

## Shake dirombak + haptics (11 Sep 2026) — dari feedback *"screenshake-nya terlalu brutal"*

Bener, dan penyebabnya dua, yang kedua lebih parah dari yang kelihatan.

**Satu: angkanya kegedean.** Tumbukan diset `16 + 30·k` selama 0,68 detik, alias 46–64.
Shake terbesar di seluruh game sebelumnya cuma 30, dan itu pun lebih pendek.

**Dua: getarnya gak pernah meluruh selama penetrasi.** `shake()` nyimpen magnitudo
*terbesar* yang pernah dikasih (`Math.max`), dan penetrasi manggil `shake(kv*3.5)` **tiap
frame**. Jadi kamera dipaku di jitter penuh sepanjang penetrasi, tanpa peluruhan sama sekali.
Itu sumber mualnya, bukan hantamannya.

**Tiga, yang struktural: shake-nya white noise murni** di dua sumbu (`U.rand(-m, m)` tiap
frame). Noise acak kebacanya *layar rusak*, bukan *hantaman*.

### Yang diubah

Shake sekarang dua bagian, karena keduanya ngomong hal beda:

| | apa | peran |
|---|---|---|
| **KICK** | osilasi meluruh **sepanjang sumbu datangnya hantaman** | ini kejadiannya |
| **NOISE** | jitter acak, 38% dari magnitudo | ini cuma tekstur |

Kick terarah di magnitudo **setengah**-nya kerasa lebih keras daripada noise murni di dua
kali lipatnya. Puncaknya turun dari **~46px jadi ~21px**, dan rata-rata selama penetrasi dari
jitter penuh jadi **1,7px**. Getar per-frame dihapus total; ledakan kecil tiap lewat lapisan
strata yang sekarang bawa rasa "lagi nyobek tanah".

`Game.shake(mag, dur, dx, dy)` — `dx, dy` opsional, kalau gak diisi ya rumble tak berarah
seperti dulu, jadi semua ~20 pemanggilan lama tetap jalan.

### Haptics

`navigator.vibrate`, semuanya pulsa pendek dan diskret. **Gak ada yang ditahan atau diulang**
— getar terus-menerus kebacanya kayak HP rusak dan boros baterai.

| momen | pola (ms) |
|---|---|
| luncur | `[12]`, PERFECT `[12,28,22]` |
| **tumbukan** | `[18–60, 40, ~45%]`, diskalakan energi |
| lewat strata | `6–16` |
| rare find | `[16,45,16,45,40]` |
| bor berhenti | `[30,60,14]` |

> **iOS Safari gak mendukung Vibration API sama sekali.** Di iPhone semua panggilan ini
> no-op senyap, dan tombolnya nulis `Haptics: n/a` alih-alih pura-pura nyala. Jadi haptics
> itu **pelengkap** screen shake, bukan pengganti — game harus tetap utuh tanpa dia.
> Android Chrome jalan.

### Dua tombol baru di settings

`Shake: 100% / 65% / 35% / OFF` dan `Haptics: ON / OFF`. Keduanya kesimpen di save dan langsung
berlaku; tombol shake ngasih preview getar sekali tiap ditekan. Ini pertanyaan rasa, dan
satu-satunya cara jawabnya adalah nyobain luncuran yang sama di beberapa setelan — bukan
nebak dari sini.

Terukur: peak `21 / 12 / 7 / 0` px, dan `Haptics: OFF` menghasilkan **nol** panggilan vibrate.


---

## STORAGE dicabut (11 Sep 2026)

Kapasitas angkut dihapus. Bukan dimatiin — dicabut sampai akar: `CFG.STORAGE_BASE/PER`,
`Game.storageMax`, `run.fullT`, `cb.canCollect()`, kondisi akhir `STORAGE FULL`, dan tombol
upgrade STORAGE. Upgrade tinggal **tiga**: POWER · IMPACT · DRILL, dan jumlah kolom bar
sekarang ngikutin `UPGRADES.length` biar gak nyisain lubang.

`Save.data.storage` **sengaja ditinggal** di file save biar gak ada yang pecah; dia cuma udah
gak ngapa-ngapain. Pil HUD-nya tetap ada, isinya berubah dari `3/5` jadi `×8` — hasil panen
run ini, tanpa penyebut.

Ini sekalian nutup keluhan lama di bagian "yang perlu dinilai jujur": **STORAGE itu yang
bikin upgrade DRILL berasa gak ngefek.** Run selesai karena pod penuh di 40–60m, bukan karena
kehabisan kedalaman, jadi nambah MAX DEPTH gak keliatan hasilnya. Sekarang satu-satunya
kondisi akhir adalah MAX DEPTH, jadi DRILL yang nentuin berapa lama lo di bawah.

### Yang keukur sesudahnya

| lv (power/impact/drill) | kedalaman | mineral | koin | durasi run |
|---|---|---|---|---|
| 1/1/1 | 65m | 8 (6 dari tumbukan) | +175 | 10,3s |
| 3/3/2 | 91m | 11 (5) | +407 | 11,9s |
| 5/5/4 | 136m | 17 (9) | +396 | 17,8s |
| 10/8/8 | 246m | 35 (23) | +1037 | 28,1s |

Semua run sekarang berakhir `MAX DEPTH` (atau nama site), gak pernah lagi `STORAGE FULL`.

### Dua akibat yang harus dipantau

**1. STORAGE ternyata juga pembatas DURASI run.** Tanpa dia, DRILL yang nentuin, dan DRILL
tinggi = run panjang. Lv10 sekarang **28 detik** per run; dulu dipotong storage jadi sekitar
10. Buat casual mobile itu kepanjangan. Yang paling mungkin dipakai buat ngerem: naikin
`DRILL_VY` / `DRILL_VY_DEEP` biar ngebornya lebih cepat, bukan naruh cap balik.

**2. Tumbukan sekarang manen lebih banyak dari nyetir manual.** Di Lv10, **23 dari 35**
mineral keambil otomatis pas penetrasi, karena penetrasi nyapu 138m tanah tanpa disetir. Dulu
pod keburu penuh jadi porsinya kecil. Ini ngelawan prinsip yang sengaja dipasang waktu bikin
loop meteor: *penetrasi itu buat KEDALAMAN, nyetir manual yang buat MINERAL*. Radius ambil
otomatis (`r + m.r + 6`) kandidat pertama buat dikecilin, atau mineral yang kena tumbukan
dikasih nilai lebih rendah.

Dua-duanya **belum disentuh** — mencabut storage itu yang diminta, dan nge-rebalance ekonomi
di gerakan yang sama bakal bikin gak jelas mana efek yang mana.


---

## PERFECT dibedain (11 Sep 2026) — dari feedback *"perfect harus dibuat sangat satisfying"*

Pas dicek, PERFECT di loop meteor justru **kehilangan** sebagian besar bedanya. Dua sebab:

**1. OVERDRIVE itu timer, bukan keadaan.** `OVERDRIVE_T` 2,6 detik. Penerbangan Lv1 cuma
1,58 detik jadi kebetulan aman, tapi di atas Lv3 penerbangannya lebih lama — jadi meteornya
**berhenti menyala di tengah jatuh**, persis pas seharusnya paling panas. Sekarang di mode
IMPACT overdrive gak di-decrement sama sekali: dia keadaan "sedang jadi meteor", dan
selesainya pas tumbukan. Terukur di Lv5: **nyala 2,83 detik dari penerbangan 2,85 detik**.

**2. Blok efek api ada SESUDAH `return` cabang impact.** Jadi PERFECT gak dapat jejak api,
bara, atau percikan sama sekali — cuma badan pod yang berubah oranye. Sekarang mode impact
punya blok meteornya sendiri.

### PERFECT sekarang beda di empat momen, bukan satu

| momen | PERFECT | selain PERFECT |
|---|---|---|
| **luncur** | dua gelombang kejut, semburan searah laras, hitstop 0,13s, slow-mo 0,16s, akor naik | satu ring, hitstop 0,05s |
| **terbang** | **terbakar sepanjang jalan**: jejak api, bara rontok, panas naik seiring kecepatan jatuh | garis kecepatan biru pucat |
| **jatuh** | beat **`BURNING UP!`** sekali pas jatuhnya jadi serius, plus siulan yang naik terus | angin doang |
| **tumbukan** | **`PERFECT IMPACT! / MAXIMUM ENERGY`**, gelombang api tambahan, slow-mo 0,3s, lapisan bass ekstra | `BIG/WEAK IMPACT` |

Terukur di Lv5, per rating: puncak partikel **386 (PERFECT) lawan 240 (GREAT) lawan 174
(GOOD)**, dan PERFECT satu-satunya yang memicu `perfectLaunch`, `ignite`, `whistle`, dan
`perfectImpact`.

Yang penting, **bedanya bukan cuma presentasi**: PERFECT tetap berarti ENERGI MAKSIMAL, dan
itu yang nentuin kedalaman tumbukan. Di Lv4: WEAK 12,9m · GOOD 20,4m · GREAT 25,5m ·
**PERFECT 43,3m**.

### Flash diturunin (bukan dinaikin)

Screenshot pertama nunjukin tumbukan berenergi tinggi bikin **whiteout hampir penuh selama
sepertiga detik** — yang justru **nyembunyiin** kawah dan bongkahannya, dua hal yang jadi
tujuan tumbukan itu sendiri. Cap-nya diturunin `0,95 → 0,70`, peluruhannya sekarang makin
cepat kalau makin terang (`2,6 + flash·3,4`) jadi dia **letupan**, bukan basuhan. Skala
tumbukan dibawa ring sama jumlah partikel.

Sekalian: flash `RARE FIND!` diturunin `0,90 → 0,58`. Dia sempat **lebih terang dari
PERFECT IMPACT**, dan hal paling terang di layar harusnya judulnya, bukan sorotannya.


---

## Peluncuran diperbaiki + tanah hancur beneran (11 Sep 2026)

### "Aneh sih meluncurnya"

Diukur, dan ini bug lama yang baru ketahuan karena mode meteor bikin momen luncur jadi
sorotan. **Peluncuran jalan dalam slow motion selama 667ms**, di semua rating, bukan cuma
PERFECT.

Penyebabnya pemulihan hitstop: `U.damp(timeScale, 1, 6, dt)`. Lambda 6 itu glacial — habis
freeze, `timeScale` butuh sekitar setengah detik buat balik ke 1. Jadi pod **merayap** keluar
dari pad terus pelan-pelan ngebut, persis kebalikan dari rasa yang dicari.

```
sebelum:  0ms ts0.02   100ms ts0.27   200ms ts0.60   300ms ts0.78   700ms ts0.98
sesudah:  0ms ts0.02   100ms ts0.32   200ms ts0.92   300ms ts0.99   400ms ts1.00
```

Lambda 6 → **22**. Hitstop itu freeze-lalu-JALAN, ramp-nya cuma ada biar gak kelihatan
melompat. Jarak tempuh 300ms pertama naik dari 2,7m jadi **13,1m**.

Sekalian dua hal yang gw tambahin kemarin dan ternyata salah arah dicabut lagi: slow-mo 0,16
detik pas PERFECT luncur (slow-mo itu buat menikmati sesuatu yang lagi **mendarat**, bukan
sesuatu yang harusnya **menjauh** dari kita), dan hitstop PERFECT diturunin `0,13 → 0,09`.

### Tanah hancur beneran

Sebelumnya kawah itu **tipuan gambar**: cuma nge-dent garis terrain yang dilukis, `yAt()`
sama sekali gak berubah. Sekarang **heightfield-nya yang ditulis ulang**.

```js
World.carveCrater(x, rPx, depth, pal)   // menulis langsung ke World.hs
```

Karena `hs` yang berubah, `yAt()` ngembaliin tanah yang baru — jadi **tabrakan, kerak atas,
pijakan prop, dan setiap peluncuran berikutnya semuanya lihat lubangnya**. Bukan lapisan
kosmetik di atas permukaan yang utuh. Terukur: satu tumbukan Lv1 PERFECT menggali **29,6px**
di titik hantam, dan `yAt()` di situ ikut turun 29,6px.

Ongkosnya beberapa puluh penulisan array per tumbukan. Nol kerja per-piksel.

**Kawahnya menetap dan menumpuk.** Tiga peluncuran berturut ninggalin tiga lubang beneran di
114m, 138m, dan 165m sedalam 30/34/40px. Lanskapnya jadi catatan ke mana save ini pernah
menghantam. `Reset Progress` ngebersihin.

Yang ditambahin di atas geometri aslinya cuma dua: **gosong** yang meredup dari panas ke arang
selama dua detik, dan **retakan** yang merambat keluar dari bibir kawah ngikutin permukaan
asli. Keduanya di-author sekali per tumbukan.

| konstanta | nilai | |
|---|---|---|
| `CRATER_R_BASE` / `_SCALE` | 30 / 46 px | radius per unit energi |
| `CRATER_DEPTH_BASE` / `_SCALE` | 8 / 22 px | kedalaman per unit energi |
| `MAX_CRATER_DEPTH` | 130 px | batas turun dari tanah ASLI |
| `MAX_CRATERS` | 40 | kerusakan tertua dilupakan |

`World.hs0` nyimpen tinggi pristine, dipakai buat dua hal: ngebatesi galian (tanpa itu,
hantaman berulang di satu titik bakal ngebor poros lurus ke bawah) dan ngembaliin dunia utuh.

**Satu risiko yang ditutup:** dinding kawah itu sekitar **13× lebih curam** dari yang pernah
diizinkan slope limiter. Buat meteor yang berhenti pas kena, itu gak masalah. Buat pod yang
mantul, itu persis tebing yang bikin slope limiter dibikin dari awal. Jadi `World.clearCraters()`
dipanggil tiap ganti SURFACE MODE — kerusakan tumbukan gak hidup lebih lama dari mode tumbukan.

### Lanjutan: *"tanah hancurnya masih aneh, cuman yang atas aja"*

Bener, dan ini bukan soal kedalaman galian — geometrinya udah beneran berubah. Masalahnya
**apa yang digambar di dalam lubang**.

Kerak atas digambar sebagai **satu stroke panjang yang ngikutin garis permukaan**:

```js
ctx.moveTo(x0, surfAt(x0));
for (...) ctx.lineTo(x, surfAt(x));
ctx.lineWidth = 30; ctx.stroke();     // pal.top2
ctx.lineWidth = 14; ctx.stroke();     // pal.top
```

Begitu permukaannya nge-dip, stroke itu ikut turun — jadi **kawahnya dilapisi rumput**.
Bagian dalamnya keliatan persis sama kayak tanah yang gak tersentuh, cuma lebih rendah.
Itu yang bikin kebacanya "cuma yang atas aja pindah".

Tumbukan harusnya **ngelupas** lapisan itu. Sekarang ada `World.drawExcavated()` yang jalan
setelah kerak digambar, dan dia cuma bisa muncul di tempat tanahnya beneran kegali — daerahnya
ditentukan dari `hs` lawan `hs0`, bukan dari angka yang dikarang.

Isinya tiga hal:

- **Muka potongan baru.** Bagian dalam kawah diisi ulang pakai subsoil yang lebih gelap dari
  tanah permukaan, nutupin kerak yang tadi ikut mlorot ke dalam.
- **Strata yang tersingkap di dinding.** Garis-garis horizontal, karena lapisan tanah memang
  horizontal — ini isyarat yang bilang "lo lagi lihat penampang tanah", bukan cekungan.
- **Bongkahan di lantai.** Empat sampai delapan batu, separuh terkubur, di-author sekali per
  kawah pakai seed jadi posisinya gak kedip tiap frame.

Sekalian, **lantai kawahnya dibikin gak rata**: tiap kolom dikasih jitter `±22%` dari
kedalaman, dan itu masuk ke `hs` beneran. Mangkuk `smoothstep` yang mulus kebacanya penyok,
bukan pecah.

Biayanya diukur: **1,81 ms/frame dengan 27 kawah sekaligus di layar** pada zoom paling jauh
(0,34). Masih jauh di bawah anggaran 16,7 ms. Dan `clearCraters()` diverifikasi ngebalikin
`hs` persis ke `hs0`.


---

## Partikel: dari kotak jadi bentuk beneran (11 Sep 2026)

Debris-nya selama ini **kotak yang muter** dan **lingkaran bertepi keras**. Itu yang bikin
kebacanya "bentuk geometri", bukan tanah dan batu.

### Kenapa digenerate, bukan bikin sprite di Figma

Dua alasan, dan yang kedua diukur.

**Satu:** partikel diwarnai per biome saat runtime — tanah grassland, batu pasir desert,
basal volcanic, bara, garis kecepatan biru. Satu PNG bakal butuh satu salinan per warna,
dan proyek ini bentuknya nol file aset, build satu file, gak ada yang perlu di-load.

**Dua:** gw beneran coba jalur sprite dulu — atlas yang digenerate prosedural saat boot,
di-cache per warna, sekali `drawImage` per partikel. Terus diukur:

| | 400 partikel |
|---|---|
| sprite sheet | **2,90 ms/frame** |
| primitif lama (arc/rect) | **0,86 ms/frame** |

**3,4× lebih lambat.** `drawImage` yang nge-scale cell 40px turun jadi chunk 6px harus
ngefilter, ratusan kali per frame. Di HP itu jatuh persis di momen tumbukan, frame tersibuk
di game. Asumsi awal gw ("satu drawImage itu murah") salah, dan cuma ketahuan karena diukur.

### Yang dipakai akhirnya

Poligon tak beraturan yang **di-generate sekali dan dipakai bareng**. Delapan siluet per
jenis, disimpan sebagai `Float32Array` koordinat satuan; partikel cuma nyimpen indeks varian,
nol alokasi per partikel.

- **`rock`** — 5–7 sisi, wobble 0,42: bersudut, seperti batu
- **`clod`** — 7–9 sisi, wobble 0,24: bulat-benjol, seperti gumpalan tanah
- **`shard`** — serpih panjang tak simetris, bukan wajik simetris
- **`dust`** — dua cakram konsentris beda alpha: tepi lembut dengan satu arc ekstra
- **`streak`** — segitiga meruncing, bukan garis berketebalan tetap

Plus satu segitiga bayangan di sisi kanan-bawah tiap chunk yang cukup besar (`r > 6`), yang
ngasih volume tanpa perlu warna kedua — jalan di tint apa pun.

### Yang sebenernya mahal ternyata bukan bentuknya

Versi pertama pakai `save / translate / rotate / scale / restore` per partikel. Diukur per
200 partikel, di atas baseline adegan kosong:

| | sebelum | sesudah |
|---|---|---|
| clod (8 sisi + facet) | 1,25 ms | **0,08 ms** |
| shard | 0,57 ms | **0,16 ms** |
| dust | 0,93 ms (sprite) | **0,06 ms** |
| lingkaran biasa (pembanding) | 0,26 ms | 0,10 ms |

**Biayanya lima panggilan state canvas per partikel, bukan jumlah sisinya.** Muter delapan
vertex di JS itu praktis gratis dibanding itu, jadi transformasinya dipindah ke dalam
`drawP` dan context-nya gak disentuh sama sekali. Turun **15×**, dan sekarang poligon
bersegi-delapan lebih murah daripada `ctx.arc`.

### Anggaran frame tersibuk

Diukur dengan ngelepas satu per satu dari frame tumbukan:

| komponen | biaya |
|---|---|
| 448 partikel | 1,35 ms |
| shockwave ring | 0,42 ms |
| 92 mineral + 53 batu (masing-masing punya glow radial) | 0,97 ms |
| sisanya (terrain, kawah, pod, HUD) | 1,02 ms |
| **total** | **3,76 ms** |

Partikel bukan lagi biaya terbesar. Yang layak dilihat berikutnya kalau HP mulai berat itu
**glow radial per mineral**, bukan debris-nya.


---

## Kawah gaya Tank Stars (11 Sep 2026) — hasil riset teknik

### Keluarga teknik Worms-like

> **Koreksi atribusi.** Judul bagian ini sempat berbunyi "cara Worms / Tank Stars
> sebenernya". Itu overclaim: **gak ada sumber publik yang menjelaskan internal Tank Stars**,
> dan gw gak punya dasar buat bilang mereka pakai metode tertentu. Yang ada itu keluarga
> teknik *Worms-like destructible terrain* yang sering dirujuk buat kasus serupa.

Dari sumber teknik klasiknya ([Emanuele Feronato](https://emanueleferonato.com/2010/06/25/worms-like-destructible-terrain-in-flash/),
[GameDev.net](https://gamedev.net/forums/topic/440139-how-can-i-create-destructible-2d-terrain-like-worms-scorched-earth/),
[jastanton](http://jastanton.com/experiments/Destructible-Terrain/)):

> Terrain itu **satu bitmap yang sekaligus jadi visual DAN data tabrakan**. Ledakan itu
> literally menghapus sebuah **lingkaran** dari bitmap itu (`BlendMode.ERASE` di Flash,
> `destination-out` di Canvas). Tabrakan dicek dengan baca piksel di bitmap yang sama.
> Gak ada struktur data kedua.

Port mentah-mentah gak jalan di sini: dunia kita 4200m × 8px/m = **33.600px** lebarnya. Satu
bitmap sebesar itu gak masuk akal di HP.

### Yang diambil, dan kenapa cukup

Dua hal dari teknik itu yang beneran bikin tampilannya, dan dua-duanya bisa dipakai tanpa
ganti arsitektur:

**1. Bentuknya LINGKARAN, bukan cekungan.** Ini yang paling menentukan. Sebelumnya gw pakai
`smoothstep` bowl — lebih lebar, lebih landai, kebacanya penyok. Sekarang yang dikurangkan
beneran busur lingkaran.

> Kuncinya: **heightfield bisa menyimpan lingkaran itu dengan persis.** Satu-satunya bagian
> kawah permukaan yang pernah kelihatan adalah busur bawahnya, dan itu fungsi dari x. Dua
> representasi ini cuma berbeda kalau ledakannya cukup dalam sampai menggantung (undercut),
> dan tumbukan permukaan gak pernah begitu. Jadi tampilannya dapet, dan terrain tetap **satu
> sumber kebenaran** buat gambar sekaligus tabrakan — persis semangat teknik aslinya.

Geometrinya: buat gigitan sedalam `depth` dan selebar `rPx` di permukaan tanah,
`R = (rPx² + depth²) / (2·depth)`, pusatnya di `groundY + depth − R`. Diverifikasi: deviasi
maksimum dari busur ideal **1,6px**, di bawah jitter ±5,3px yang emang sengaja ditambahin
biar tanahnya gak kelihatan dibubut.

**2. Garis tepi tegas.** Tanpa outline gelap sepanjang potongan, lubang seakurat apa pun
kebacanya cuma noda.

### Satu belokan yang salah, dan kenapa

Sempat gw isi rongganya pakai "dinding seberang cekungan", alasannya tanah kita massa padat
sementara terrain Worms itu pulau tipis. **Itu keliru dan bikin jauh lebih jelek** — kawahnya
berubah jadi massa gelap dan siluetnya hilang sama sekali.

Tank Stars memperlakukan tanah sebagai **penampang melintang**: material yang hilang ya
hilang, dan latar belakang kelihatan menembus gigitan itu. **Siluet itulah bacaannya.** Yang
kurang di percobaan pertama bukan isian, tapi outline. Dikembalikan, komentarnya ditinggal di
kode biar gak diulang.

### Sisanya

- **Prop di dalam kawah dihancurkan.** Semak dan batu yang tetap berdiri tegak di tengah
  kawah meteor itu penanda paling kencang bahwa destruksinya cuma gambar. Ditandai, bukan
  dihapus, jadi `clearCraters()` bisa ngembaliin tanah **dan** pemandangannya.
- **Gosong ngikutin lantai gigitan**, bukan elips raksasa di tengah kawah. Yang lama, di
  radius 109px, nyapu 220px gelap di layar dan kebacanya bayangan di bawah terrain.

### Terukur

| | |
|---|---|
| deviasi dari busur lingkaran ideal | 1,6px |
| biaya gambar, 23 kawah sekaligus di layar | **1,55 ms/frame** |
| mantulan tanah, keempat rating | **0** |
| `clearCraters` mengembalikan `hs` ke `hs0` | persis |

Kedalaman tumbukan Lv1 gak bergeser: WEAK 7,5m · GOOD 13,4m · GREAT 14,4m · PERFECT 28,2m.


---

## Tunnel yang menyempit (11 Sep 2026)

Dari catatan riset Irvan, satu ide yang belum ada di sini dan ternyata yang paling berdampak:

> Jangan cuma satu lingkaran. Cap beberapa lingkaran sepanjang lintasan, dan **kecilkan
> radiusnya seiring energi habis** — biar pemain bisa lihat momentumnya menipis.

Sebelumnya tunnel digambar sebagai **stroke berketebalan tetap** (dua `strokePath`, lebar 30
dan 24). Sekarang tiap titik tunnel nyimpen radius bore-nya sendiri:

```
r = lerp(TUNNEL_R_MIN, TUNNEL_R_MAX, clamp(sqrt(impactE) / TUNNEL_R_FULL))
```

Hasil terukur, dari mulut ke ujung:

```
30 30 30 30 28 25 21 16 12 12 12 12 12 12 12 12 ...
└──── tumbukan merobek ────┘└──── bor bertenaga ────┘
```

Mulut robek 30px menyempit ke bor bersih 12px. **Transisi dari tumbukan ke ngebor manual jadi
kebaca dari bentuk lubangnya sendiri**, tanpa satu kata UI pun. Dan bore-nya ikut nyeritain
kualitas luncuran: WEAK bikin mulut 22px, PERFECT 30px.

Digambar sebagai **satu poligon lancip** (jalan satu sisi maju, sisi lain mundur, offset
tegak lurus arah lokal), bukan stamp lingkaran per titik. Diukur: **−0,02 ms/frame** untuk 79
titik, alias lebih murah dari dua stroke yang digantiin. `strokePath` jadi gak kepake dan
dihapus.

### Hitstop dikembalikan ke rentang wajar

Referensi yang dipakai Irvan buat impact freeze itu 40–80ms. Punya kita 60–210ms, dan
seperlima detik frame beku berhenti kebaca sebagai pukulan lalu mulai kebaca sebagai
tersendat. Sekarang `0,045 + 0,042·k`, terukur **58–121ms** tergantung energi.

Catatan buat pengukuran berikutnya: menghitung semua frame ber-`freezeT` sepanjang run
ngasih 300–617ms, tapi itu **kumulatif** — tiap mineral, batu, dan rare find punya hitstop
sendiri. Hitstop tumbukan harus diukur tepat di frame tumbukannya.

### Yang TIDAK diambil, dan kenapa

Arsitektur Unity yang Irvan rancang (mask RenderTexture + collider permukaan yang dimatikan
setelah impact + tanpa regenerasi PolygonCollider) itu **tepat buat port Unity**, dan
pemisahan "visual destruction vs game physics"-nya udah kejadian di sini secara alami: begitu
pod menembus, gak ada lagi yang nabrak permukaan sampai run berikutnya.

Tapi di prototype canvas ini, heightfield udah ngasih dua-duanya sekaligus dengan satu array
`Float32Array` — gambar **dan** tabrakan, tanpa Marching Squares, tanpa chunk collider, tanpa
`SetPixel`. Pindah ke mask piksel di sini cuma bakal nambah satu sumber kebenaran kedua yang
harus disinkronkan, buat kemampuan (overhang, terowongan tembus) yang gak dipakai desainnya.

Catatan itu jadi relevan lagi **kalau** nanti permukaan perlu tetap bisa ditabrak setelah
hancur — misalnya kalau pod mantul lagi, atau ada fase kedua di permukaan.

---

## Momen mendarat diperbaiki (12 Sep 2026) — dari feedback *"kok aneh waktu mendaratnya"*

Tiga hal bertumpuk, dan urutannya kebalik total.

**1. Bor menggantung di atas lubangnya sendiri.** Tes kontak balistik menempelkan pod ke
permukaan yang *disentuh* (`yAt(x) - r`), lalu `carveCrater` langsung menghapus ~35px tanah
di bawahnya. Hasilnya pod berhenti di udara, 37px di atas dasar kawah yang baru kebuka.

**2. Hitstop membekukan frame yang salah.** Freeze 98ms plus slow-mo PERFECT menahan
gambar itu ~220ms. Yang kelihatan pemain: tanah bolong duluan, bor diam melayang, ledakan
baru nyusul. Sebab dan akibat kebalik.

**3. Partikel numpuk jadi satu bola.** Semua debris dan 54 puff debu di-spawn dari satu
titik yang *sekarang sudah jadi udara*, terus ikut beku. Hasilnya satu cakram krem opak
menutupi kawah selama freeze.

### Yang diubah

| | sebelum | sesudah |
|---|---|---|
| posisi pod saat impact | 37px **di atas** tanah | 19px **terbenam** |
| impact depth akhir vs prediksi 35m | 24,5m | 35m |
| gambar 374 partikel, frame tersibuk | — | 0,173 ms |

- **`Game.onImpact`** menanam pod di dasar kawah (`p.y = max(p.y, floorY)`) tepat setelah
  kawah dipahat, di frame yang sama dengan flash dan camera kick. Freeze-frame sekarang
  nampilin bor nancep di dasar kawah, bukan melayang. Efek sampingnya kedalaman tumbukan
  akhirnya pas sama prediksinya — kawah itu memang kedalaman, dan sebelumnya gak kehitung.
- **`FX.spawnAt`** baru: `spanX` nyebar spawn sepanjang mulut kawah, `groundY` naruh tiap
  partikel di permukaan tanah yang baru, `lead` maju-in tiap partikel sepanjang kecepatannya
  sendiri sampai 0,05 detik. Frame nol langsung kebaca sebagai semburan, bukan gumpalan.
- **Debu** digambar pakai siluet `puff` bergelombang beralpha rendah (0,30 / 0,34), bukan
  dua lingkaran pekat (0,5 / 0,85). Empat puluh lingkaran sempurna kebaca sebagai gelembung
  sabun; siluet lumpy yang masing-masing tipis menumpuk jadi satu awan.

### Bug yang ketemu bareng: kawahnya ketimbun sendiri

`drawUnderground` ngecat band tanah sebagai **persegi panjang** mulai dari `ug.surfaceY` —
garis tanah datar yang diambil saat impact, **sebelum** kawah dipahat. Persegi itu nimpa
kawah yang udah digambar `drawTerrain` dan ngisinya balik, jadi tanah kelihatan mulus tanpa
luka sementara tunnel mulai 35px di bawahnya dan kelihatan mengambang.

`World.clipToSoil()` sekarang motong **seluruh** `drawUnderground` ke heightfield hidup
(kawah ikut terhitung), bukan cuma tunnelnya. Band tanah, speckle, dinding batas dan tunnel
semuanya berhenti di tanah yang benar-benar ada.

---

## Mode pantulan dicabut (12 Sep 2026) — dari feedback *"pake yang impact aja"*

BOUNCE / DECAY / PLANT, HOLD-to-dive, booster pad dan booster chain semuanya dihapus. Yang
tersisa satu loop: **tap → busur → tumbukan → penetrasi → ngebor manual**.

Alasannya sederhana: tiga aturan permukaan hidup bareng berarti setiap konstanta, setiap
angka di simulator dan setiap keputusan desain harus dijawab empat kali. Loop meteor menang
di semua feedback sejak 11 Sep, jadi tiga sisanya cuma biaya perawatan.

### Yang hilang

| berkas | sebelum | sesudah |
|---|---|---|
| `js/game.js` | 1850 | 1396 |
| `js/world.js` | 1996 | 1633 |
| `js/player.js` | 611 | 356 |
| `js/audio.js` | 323 | 288 |
| `dist/drill-orbit.html` | 264,2 KB | 205,3 KB |

Yang dicabut, per sistem:

- **Fisika pantulan** — `Pod.updateFlight` versi bouncing (substep, normal permukaan,
  restitusi, tangential scrub, rolling, friction zona) hilang. `updateBallistic` naik jadi
  `updateFlight`, satu-satunya jalur terbang.
- **Kontrol udara** — HOLD-to-dive, `diveVy`, arming pointer/space, kamera yang miring pas
  nyelam, jet dive, dan seluruh hint "HOLD TO DIVE / HIT BOOSTERS".
- **Booster** — tabel `SURFACE_BOOSTERS`, `buildBoosters`/`resetBoosters`/`boosterAt`/
  `nextBooster`/`drawBoosters`, art `drawBooster`, chain, dud, dan semua `CFG.BOOST_*`.
- **Sikap mendarat** — flare, plant, `PLANT_SINK`, `DIVE_ANGLE`, `FLARE_*`. Bor sekarang
  selalu ngikutin vektor kecepatan, karena selalu ada tepat satu kontak per run.
- **State mesin** — `settle` dan `dive` hilang. Alurnya `ready → charge → flying →
  penetrate → drill → result`.
- **Settings** — pemilih SURFACE MODE, slider Dive accel dan Boost vy.
- **Suara** — `bounce`, `boost`, `dud`, `dive`, `plant`.

### Save lama tetap aman

Kunci `bounce` di save **tetap** dipakai buat level upgrade IMPACT. Namanya warisan dari
waktu pantulan masih jadi inti; ganti kunci berarti semua save yang ada kehilangan level
upgrade-nya.

Field yang cuma dipakai versi lama (`surfaceMode`, `impactV2`, `tutDive`, `tutBoost`,
`storage`) sekarang gak pernah dibaca lagi. Perlu dicatat: `Object.assign({}, DEF, saved)`
**mempertahankan** kunci yang gak dikenal, jadi field-field itu tetap nangkring di
localStorage, bukan kebuang. Gak ada yang menyangkut progres, dan migrasi yang kerjanya
cuma menghapus byte mati lebih mahal daripada membiarkannya.

### Alat ikut dirampingkan

`tools/flight-sim.mjs` ditulis ulang di sekitar loop impact. Subcommand `baseline`, `pump`,
`sweep`, `chain` dan `modes` hilang bareng mekanik yang mereka ukur; sisanya `impact`,
`reach` dan `path`. `impactRun` sekarang juga memahat kawah dan menanam pod persis kayak
`Game.onImpact`, jadi prediksi vs aktual bisa dibandingkan jujur:

```
predicted vs actual penetration: 30m vs 29.4m     (sebelumnya 30m vs 24.5m)
mechanical energy drift across the whole arc: 1.2%
```

`tools/check-layout.mjs` sekarang cuma validasi SITES (urutan, near-band, batas dunia,
biome), karena gak ada pad lagi yang bisa nabrak zona pendaratan.

### Tangga Lv1 sekarang

```
WEAK       32.3m  -
GOOD       51.6m  IN crate
GREAT        66m  IN crate
PERFECT   113.8m  2m SHORT crystal
```

### Yang masih perlu dinilai jujur

- Satu busur per run bikin permukaan jadi **lebih pendek**. Run Lv1 PERFECT sekarang 1,58
  detik di udara. Cukup atau kependekan, cuma bisa dijawab dengan main.
- Tanpa pad, jangkauan murni POWER × timing. Kurva progresinya jadi rapi, tapi juga jadi
  satu dimensi — gak ada lagi "skill step" yang bisa dilompatin pemain bagus di level rendah.

---

## Tunnel digambar sebagai jejak lingkaran (12 Sep 2026)

Diambil dari prototype pembanding di `ChatGPT/drill 2`, yang bikin lubangnya dengan cara
keluarga Worms/Tank Stars: **lubang itu deretan lingkaran yang dihapus**, bukan satu bentuk
yang diekstrusi. Sebelumnya kita bikin outline poligon meruncing lewat `tunnelPath()` —
jalan keluar satu sisi, balik lewat sisi lain, offset tegak lurus arah lokal. Hasilnya
rapi, dan justru itu masalahnya: dindingnya mulus seperti pipa, bukan tanah yang dirobek.

### Yang berubah

`World.stampTunnel(ug, x, y, r, ragged)` mencatat jejak di sepanjang segmen yang baru
ditempuh, satu tiap 4,5px, masing-masing dengan radius yang di-jitter. Yang benar-benar
bikin dindingnya kelihatan patah bukan jitter radiusnya — jejak yang berjarak 4,5px saling
menelan, jadi variasi radius nyaris hilang di union. Yang bekerja itu **cuilan di luar
sumbu**: lingkaran kecil yang dilempar ke samping dengan peluang `0,3 × ragged`. `ragged`
ikut sisa energi, jadi mulut tunnel dikunyah dan ekornya nyaris bersih.

### Bedanya dengan sumbernya: gak ada yang dihapus

Referensinya menghapus piksel dari bitmap 2400×2600, dan bitmap itu **gak pernah dibaca
balik** — tabrakannya tetap pakai fungsi `surfaceY(x)` yang mulus. Jadi di sana kawahnya
murni dekorasi, dan tanahnya digambar ulang dari nol tiap run.

Kita tetap pakai heightfield. Kerusakan kita nyata: tabrakan, kerak, prop dan peluncuran
berikutnya semuanya melihat kawahnya, dan kerusakannya menetap lintas run. Jejak lingkaran
di sini cuma **cara menggambar** poros itu, diputar ulang tiap frame dari daftar tersimpan.
Konsekuensinya satu dan penting: **tiap jitter harus dikocok sekali lalu disimpan**. Kalau
dikocok ulang tiap frame, dindingnya mendidih.

### Tiga lintasan, satu path, satu fill

Union-nya digambar tiga kali dengan radius berbeda: bayangan (+6), rim batu (+1,8), lalu
bore-nya sendiri. Tiap lintasan mengumpulkan **semua** lingkaran ke satu path dan memanggil
`fill()` **sekali**.

Itu detail yang menentukan. Kalau tiap lingkaran di-fill sendiri-sendiri, setiap tumpang
tindih kena alpha dua kali dan lintasan tembus pandang berubah jadi untaian manik-manik.
Dikumpulkan jadi satu path, aturan non-zero winding memperlakukan union sebagai satu
wilayah, jadi alpha-nya mendarat tepat sekali. Efek sampingnya: **rim-nya gratis** — cukup
gambar union yang sama sedikit lebih besar di belakangnya, gak perlu hitung outline sama
sekali. Itu juga yang menghapus kebutuhan `tunnelPath()`, yang sekarang dibuang.

### Terukur

| | nilai |
|---|---|
| jejak tercatat, run Lv1 PERFECT | 235 |
| jejak tercatat, run Lv20 (448m) | 1322 |
| gambar satu frame penuh, zoom main, Lv20 | 0,207 ms |
| gambar satu frame penuh, zoom 0,5 (kasus terburuk) | 1,84 ms |

Culling-nya bukan demi fill, tapi demi jumlah arc: galian 450m mencatat lebih dari seribu
jejak dan yang kelihatan cuma selayar. Jejak di luar viewport dibuang sebelum path dibangun.

### Yang TIDAK diambil dari sana, dan kenapa

- **Tanah sebagai bitmap.** Menukar kerusakan nyata dengan dekorasi. Kawah kita mengubah
  tempat mendarat berikutnya; kawah mereka tidak bisa.
- **Partikel kotak.** Debris di sana kotak literal, persis yang sudah kita perbaiki.

---

## Kontrol ngebor dirombak buat HP (12 Sep 2026)

Dua masalah terpisah, dan yang kedua lebih besar dari yang pertama.

### 1. Inputnya biner

Aturan lama `x < W/2 ? -1 : +1`. Sentuh separuh kiri layar, belok kiri, kecepatan penuh.
Tidak ada tengah-tengahnya, tidak ada zona mati, dan garis pemisahnya tak kelihatan. Di HP
artinya jempol nangkring di tengah area main, sentuhan pertama langsung menyentak pod ke
samping, dan buat balik arah harus menyeberangi layar.

Sekarang **drag relatif**. Titik jari mendarat jadi titik nol, dan jarak horizontal dari
situ jadi besaran beloknya. Zona mati 6px supaya jempol yang diam menahan garis lurus,
lock penuh di 62px, kira-kira selebar satu jempol.

Satu detail yang menentukan: **titik nolnya mengejar jari**, selalu paling jauh satu range
di belakangnya. Tanpa itu, setelah menarik jauh, pemain harus menyeret balik sejauh yang
tadi ditarik sebelum bor mulai menjawab. Terukur setelah tarikan 140px:

| seret balik | belok |
|---|---|
| 0px | +1,00 |
| 10px | +0,82 |
| 30px | +0,46 |
| 62px | 0 |
| 124px | −1,00 |

Pointer juga di-capture saat sentuh, jadi jari yang keluar dari kanvas tidak membekukan bor
di tengah belokan.

### 2. Wewenang setirnya terlalu kecil, dan makin dalam makin kecil

Ini masalah yang sebenarnya. `DRILL_VX_MAX` dulu angka mutlak 44 px/s melawan laju turun
50 sampai 78. Artinya kerucut geraknya **menyempit** seiring kedalaman, 41° di permukaan
jadi 29° di dasar, jadi kontrolnya diam-diam memburuk persis saat ladangnya makin menarik.

Sekarang wewenangnya **rasio dari laju turun**, bukan px/s mutlak, jadi kerucutnya tetap.
Batas atasnya bukan selera: `Pod.updateDrill` mengunci sudut hidung di 0,95 rad (54°), dan
kalau sudut gerak melewati itu pod menyamping keluar dari arah jalannya sendiri. Rasio 1,35
menaruh gerak di 53,5°, mepet batas itu dan tidak lebih.

Diukur di permukaan dan di dasar:

| | sudut gerak | menyamping per 100px turun | per baris mineral (30px) |
|---|---|---|---|
| dulu, permukaan | 41° | 88px | 26px |
| dulu, dasar | 29° | 56px | 17px |
| sekarang, permukaan | 52,6° | 131px | 39px |
| sekarang, dasar | 53,1° | 133px | 40px |

Satuan yang penting itu kolom paling kanan. Mineral duduk di kisi 46px. Dulu satu baris
kedalaman cuma membeli 26px menyamping, jadi **kolom sebelah pun sudah di luar jangkauan**
dan run-nya berjalan di atas rel. Sekarang 40px, tepat satu kolom, tiap baris.

### Yang ditambahkan biar belokan terasa

- **Percepatan** naik dari 190 ke 420 px/s². Yang lama butuh seperempat detik sampai lock
  penuh, dan di HP itu terbaca seperti bor telat menjawab.
- **Semburan tanah di sisi luar belokan**, skalanya ikut besaran belok. Tanpa ini belokan
  keras dan jalan lurus kelihatan identik.
- **Kamera miring ke arah belokan**, 34px. Itu yang bikin gerakan jempol sedikit terbaca
  sebagai keputusan.
- **Ongkos belok**: laju turun berkurang 12% pada lock penuh. Dulu menyetir itu gratis, jadi
  garis lurus dan garis berkelok sama persis kecuali hasil pungutannya. Sengaja kecil.
- **Dinding tidak memantul lagi.** Pentalan −0,25 melempar bor balik dari tepi ladang, yang
  terbaca seperti satu kesalahan dihukum dua kali. Sekarang berhenti saja.

### Yang masih perlu dinilai jujur

Kontrolnya sekarang enak, tapi **imbalan buat memakainya masih kecil**. Diuji dengan ladang
mineral berseed tetap dan bot rakus yang mengejar mineral terdekat:

| | mineral terkumpul |
|---|---|
| tanpa input sama sekali | 10 |
| bot, wewenang lama | 12 |
| bot, wewenang baru | 12 |

Menyetir sempurna cuma menambah dua mineral dari sepuluh, dan menaikkan wewenang tidak
mengubahnya. Penyebabnya bukan kontrol: kisi mineralnya terlalu rapat, 34% peluang per sel
46×30px, jadi hampir selalu ada yang nyaris tepat di bawah. Selama itu tidak diubah,
menyetir bagus dan menyetir asal hasilnya mirip. Itu tuas yang terpisah dan belum gw sentuh
karena menyangkut ekonomi koin.

---

## Kawah jadi kosmetik (12 Sep 2026) — mengikuti model `ChatGPT/drill 2`

Keputusan sadar, dan membatalkan permintaan 11 Sep *"tolong dong buat tanahnya hancur
beneran"*. Prototype pembanding di `ChatGPT/drill 2` ternyata tidak pernah merusak tanahnya:
nol pemanggilan `getImageData`, tabrakan dipakai dari fungsi analitik `surfaceY(x)`, dan
`rebuildTerrain()` dipanggil di `resetRun()` jadi kerusakannya digambar ulang dari nol tiap
run. Modelnya diadopsi ke sini.

### Tiga perubahan makna

- **Heightfield tidak pernah disentuh lagi.** `carveCrater` dulu menulis ke `World.hs`.
  Sekarang ia cuma mencatat. `yAt()` jadi satu jawaban yang tidak pernah berubah untuk
  tabrakan, kerak, pijakan prop, landasan luncur, dan setiap busur berikutnya.
- **Kawah tidak lagi mengubah tempat mendarat berikutnya.** Pod kedua di titik yang sama
  mendarat di tanah asli.
- **Bekasnya dihapus tiap run**, lewat `World.clearCraters()` di `resetToPad`.

### Jebakan winding yang memakan waktu paling lama

Kawahnya sekarang lingkaran yang dikurangkan dari path tanah. Naluri pertama: satu path
berisi poligon tanah plus lingkaran yang diputar terbalik, lalu `fill()` dengan aturan
non-zero. Itu **kelihatan benar dan salah**.

Di dalam lingkaran yang menimpa tanah, winding-nya 0, jadi bolong. Benar. Tapi di bagian
lingkaran yang **menyembul ke atas permukaan**, winding-nya −1, dan −1 itu bukan nol, jadi
bagian itu tercat sebagai tanah padat. Mangkuk utama kawah punya jari-jari 122px berpusat
88px **di atas** permukaan, jadi hasilnya piringan cokelat raksasa menggantung di langit
setiap kali ada kawah.

Tes terisolasi gw yang pertama juga cacat: gw cuma memeriksa titik di dalam lingkaran yang
ada di dalam poligon, dan satu titik di luar lingkaran. Bagian lingkaran yang di luar
poligon tidak pernah gw uji, jadi tesnya lulus padahal bugnya ada.

Jawabannya **dua clip berurutan**, bukan satu path. Clip pertama ke tanah di bawah
permukaan; itu membuat separuh-langit jadi tidak relevan. Clip kedua tinggal bilang "bukan
di dalam lingkaran", yang diungkapkan persis oleh sebuah persegi besar dikurangi
lingkaran-lingkarannya. Semua seni tanah lalu digambar lewat satu clip itu, termasuk kerak
di permukaan — dan itu yang menggantikan seluruh pass wajah-galian yang lama.

### Bentuk kawahnya

Percobaan pertama menaburkan cuilan ke mana saja dalam 1,05× jari-jari. Hasilnya lubang
terpisah di tanah datar di luar bibir, dan kawahnya berhenti terbaca sebagai satu lubang
lalu jadi gerombolan gundukan. Sekarang tiap cuilan duduk **di busur potongan mangkuknya
sendiri**, mengangkangi busur itu, jadi separuh lingkarannya jatuh di dalam gigitan dan
tidak melakukan apa-apa sementara separuhnya menggigit sedikit lagi dari dinding. Lima belas
sampai dua puluh dua cuilan, masing-masing 3,5 sampai 8,5 persen jari-jari.

### Yang terhapus

`World.hs0` (salinan tanah pristine), `drawExcavated`, `CFG.MAX_CRATER_DEPTH`, dan seluruh
penulisan ke heightfield. Yang tersisa satu tempat kerusakan itu ada: clip saat menggambar.

### Terukur

| | nilai |
|---|---|
| gambar frame penuh, ada kawah di layar | 0,342 ms |
| gambar frame penuh, tanpa kawah | 0,389 ms |
| lingkaran per kawah | 16 sampai 23 |
| `yAt()` di titik tumbukan, sebelum dan sesudah | 135 dan 135 |

Selisih waktu gambarnya di dalam derau, jadi model ini tidak membayar apa pun secara
performa.

### Yang hilang, dan itu nyata

Lanskap tidak lagi jadi catatan tempat lu pernah menghantam. Dua tumbukan di titik yang
sama tidak menumpuk. Dan kawah tidak pernah lagi memindahkan titik kontak berikutnya, yang
berarti satu dimensi konsekuensi hilang dari permainan. Yang dibeli: gambar dan tabrakan
**tidak bisa** lagi berselisih, karena cuma ada satu sumber kebenaran dan kawahnya bukan
bagian darinya.

---

## Langit dan parallax dari mockup Figma (12 Sep 2026)

Sumber: file Figma *Drill Orbit: Game UI Mockup*, node `64:854` (hijau-tosca, gunung dan
pinus) dan `59:265` (gurun senja, mesa). Keduanya frame "Atmospheric Depth". Permintaannya
jelas: pakai komponen Figma untuk latar, **tanahnya tetap gw yang bikin**.

### Yang diambil, dan yang tidak

Yang diambil itu **palet dan urutan lapisannya**, bukan seninya. Frame itu 1600px berisi SVG
tetap; dunia ini 4200 meter dan bergulir, jadi punggungan gunung tetap prosedural lewat
`atmosphereRidge` yang sudah ada. Mengimpor SVG-nya berarti seni selebar layar yang harus
di-tile, plus file aset, dan proyek ini nol file aset.

Tiga hal yang mockup itu punya dan kita tidak:

- **`haze`** — pita warna horizon yang ditimpakan **di atas** tiap punggungan, pekat di
  kakinya dan habis di puncaknya. Ini inti "atmospheric depth" yang jadi nama frame-nya:
  punggungan jauh tidak perlu lebih kecil atau lebih gelap untuk terasa di belakang, dia
  perlu **kakinya lenyap ke udara**.
- **`plain0-2`** — dataran horizon, pita gradien tiga stop antara punggungan dan tanah main.
- **`prop`** — siluet yang berdiri di dataran itu. Pinus di frame hijau, batu di gurun.

Urutan gambarnya sekarang mengikuti nama lapisan di Figma: punggungan jauh, haze, punggungan
dekat, haze, dataran horizon, props.

### Stop langit dipindah

Dulu tiga stop di 0 / 0,58 / 1. Mockup menaruh stop tengahnya di 32,7%, dan itu yang benar:
di 0,58 warna tengah mendarat tepat di garis horizon dan langit terbaca sebagai dua bidang
datar. Dinaikkan ke 0,33, warna atas punya wilayahnya sendiri dan dua pertiga bawahnya jadi
satu pudaran panjang menuju horizon.

### Dua warna yang sengaja menyimpang dari mockup

- **`mid` GREENLINE** turun jauh dari `#66bb95` yang gw sampel, ke `#3f9d7f`. Angka itu gw
  ukur dari punggungan yang **sudah di-haze oleh mockup**; memakainya sebagai warna sumber
  berarti nge-haze dua kali, dan punggungan dekatnya hilang ditelan langit.
- **`plain2` GREENLINE** turun ke `#0b7a62` dari `#13c7a7`. Di mockup pita terang itu strip
  tipis yang dibatasi bukit hijau gelap; di sini dia turun sampai menyentuh rumput dan butuh
  tempat mendarat.

Lima atmosfer lain diturunkan dari dua ini supaya perjalanannya terbaca sebagai satu set,
bukan dua frame impor dan lima orang asing.

### Terukur

| | nilai |
|---|---|
| gambar frame penuh di permukaan | 0,144 ms |
| atmosfer | 7, semuanya dapat haze, dataran dan props |
| file aset ditambahkan | 0 |

### Lanjutan: vektornya ikut dipakai

Path aslinya sekarang dipakai, bukan cuma paletnya. `js/vectors.js` berisi sembilan entri
yang disalin apa adanya dari SVG hasil ekspor Figma: dua barisan gunung dari node `64:854`,
dua barisan batu gurun dari node `59:265`, empat pinus dan satu semak. Itu path milik
desainernya, bukan tafsiran gw atas gambarnya.

**Disimpan sebagai string path, bukan file `.svg`.** Proyek ini nol file aset dan build-nya
satu halaman HTML. String path itu kode, bukan aset, dan dia tajam di zoom berapa pun tanpa
perlu salinan kedua di 2x. `Path2D` dibangun malas dan di-cache, tidak pernah saat load,
karena `tools/flight-sim.mjs` menjalankan `world.js` di dalam vm Node yang tidak punya
`Path2D` sama sekali.

**Ubin dan cermin.** Frame-nya 1600px, dunianya 4200 meter, jadi path-nya di-tile. Ubin
ganjil **dicerminkan**, dan itu gratis sekaligus tepat: sambungan cermin mempertemukan tepi
kanan dengan tepi kanan dan kiri dengan kiri, jadi jahitannya pasti cocok berapa pun tinggi
ujung path-nya. Mockup-nya sendiri melakukan persis itu — tiap barisan di sana adalah satu
grup plus salinan `-scale-x-100` dari dirinya.

**Generator punggungan lama dihapus.** `atmosphereRidge` dan field `shape` yang cuma dia
pembacanya sudah tidak ada. Tujuh atmosfer memakai dua set path itu, diwarnai ulang lewat
`far` dan `mid` masing-masing.

**Satu hal yang tetap prosedural:** batu di dataran gurun. Frame gurunnya tidak punya prop
batu terpisah — batunya dipanggang jadi satu lapisan tanah selebar 1600px, dan tanah itu
bagian gw. Jadi pinus dari Figma, batu dari kode.

| | nilai |
|---|---|
| entri vektor | 9 |
| karakter data path | 22.032 |
| gambar frame penuh, gurun (path terberat) | 0,178 ms |
| gambar frame penuh, hijau | 0,140 ms |
| file aset ditambahkan | 0 |

### Lanjutan: semua vektor dipakai, dan layoutnya diukur dari frame-nya

`js/vectors.js` sekarang 23 entri, semua yang diekspor dari dua node itu **kecuali tanah**:

| dipakai | dari |
|---|---|
| 2 barisan gunung | node `64:854` |
| 2 barisan batu gurun | node `59:265` |
| 2 pita bukit hijau | node `64:854` |
| 4 pinus + 1 semak | node `64:854` |
| 11 batu gurun | diangkat dari lapisan tanah node `59:265` |
| 11 goresan bayangan dataran | node `59:265`, di-blend `overlay` seperti aslinya |

Batu gurunnya dulu gw bilang tidak ada. Salah: batunya memang dipanggang jadi satu lapisan
bareng tanah, tapi tiap batu path-nya sendiri. Path tanah (`#563535`) dan garis rambutnya
(`#776261`) dibuang, sebelas sisanya dipakai lengkap dengan merahnya masing-masing. Satu
yang sengaja tidak dipakai: lapisan langit gurun, karena itu satu bidang emas selebar frame
yang cuma akan menimpa gradien langit kita yang sudah lebih bagus.

### Layoutnya sekarang diukur, bukan dikira

Frame mockup-nya 900px dengan horizon — puncak dataran jauh — di y 513. Tiap offset di
`drawParallax` adalah ukuran frame itu sendiri, dibagi 900 lalu dikali tinggi layar, dan
diambil relatif terhadap horizon. Nama lapisan Figma dikutip di komentar supaya urutannya
bisa dicocokkan balik ke filenya.

**Haze-nya sempat gw pasang terbalik.** Gradien di mockup itu **transparan tepat di
horizon**, memuncak pekat seperlima pita ke atas, lalu habis di empat perlima. Jadi dia
selembar kabut yang menggantung di udara dan memakan bagian tengah gunung, bukan genangan
di kaki. Tebakan pertama yang wajar adalah pekat di bawah, dan itu bikin barisan gunungnya
kelihatan **tenggelam**, bukan menjauh.

**Masalah portrait.** Mockup-nya 1600×900 landscape dan menampilkan satu barisan 1652px
utuh sekaligus; game ini kolom portrait ~490px. Dengan rasio asli, satu ubin jadi 1600px di
layar 490px, jadi sepertiga gunung memenuhi layar dan barisannya tidak pernah terbaca
sebagai barisan. SVG-nya sendiri diekspor dengan `preserveAspectRatio="none"` — desainernya
memang mengharapkannya diregangkan — jadi ubinnya dipersempit.

Persempitannya **rasio, bukan jumlah layar tetap**, dan ini penting: barisan gurun itu
3007px seni lawan 1652px milik yang hijau. Memaksa keduanya ke lebar layar yang sama
mengubah mesa berpuncak rata di gurun jadi menara tipis.

| | nilai |
|---|---|
| entri vektor | 23 |
| gambar frame penuh, hijau | 0,143 ms |
| gambar frame penuh, gurun | 0,115 ms |
| file aset ditambahkan | 0 |

### Koreksi: vektornya jangan diregangkan

Feedback: *"kok pada aneh, tolong jangan di stretch"*. Benar, dan itu salah gw.

Untuk memuat satu barisan gunung utuh ke layar portrait, gw memerasnya mendatar tiga sampai
empat kali. Mesa berpuncak rata di frame gurun berubah jadi menara tipis, dan lereng gunung
di frame hijau jadi runcing tidak wajar. Alasan gw waktu itu — SVG-nya diekspor dengan
`preserveAspectRatio="none"` jadi "boleh diregangkan" — itu pembenaran, bukan alasan.
**Siluetnya ITU seninya.** Kalau diperas, yang tersisa bukan seni desainernya lagi.

Sekarang tiap ubin digambar pada rasio aslinya. Konsekuensinya jujur: layar portrait cuma
menampilkan sebagian barisan yang lebar, lalu menggulir melewati sisanya. Itu yang dilakukan
semua game portrait dengan pemandangan landscape, dan itu jauh lebih baik daripada seni yang
penyok.

### Bug yang ketemu gara-gara itu: gunung jadi hitam di pita transisi

Waktu memeriksa keluhan "aneh", ada yang lebih buruk dari peregangan: **di dalam pita
transisi antar-atmosfer, punggungan gunungnya hitam pekat.**

Penyebabnya satu baris yang sudah lama ada. `U.mix` mengembalikan string `'rgb(r,g,b)'`,
sementara `U.hex` cuma bisa membaca `'#rrggbb'`. Dioper ke `U.hex`, string `rgb(...)` itu
jadi `NaN`, dan `(NaN >> 16) & 255` hasilnya **0** — hitam. `atmosphereAt` mencampur warna
hanya di dalam pita ±36m di sekitar tiap pergantian atmosfer, jadi bug ini cuma muncul di
72 meter dari tiap perbatasan dan tidak kelihatan di mana pun selain itu. Gw sendiri hampir
melewatkannya karena semua screenshot sebelumnya kebetulan diambil di luar pita.

`U.hex` sekarang membaca `rgb()` dan `rgba()` juga. Sekalian, `haze` dan tiga stop dataran
ikut dicampur di `atmosphereAt` — sebelumnya mereka meloncat di tengah transisi yang
harusnya mulus.

### Koreksi lagi: propnya berdiri di udara

Feedback: *"pepohonan lu salah kocak, pepohonan lu malah di air"*. Betul, dan ternyata bukan
cuma pohonnya — batu gurunnya juga melayang. Dua penyebab yang berbeda.

**Pohon.** Gw menempelkan pangkalnya ke **kotak-batas** bukit, bukan ke siluetnya. Kotak
batas itu persegi; bukitnya melengkung. Di tiap lekukan bukit, permukaan aslinya turun jauh
di bawah tepi atas kotak, jadi pohonnya menggantung di atas pita air.

Perbaikannya `vecProfile`: path-nya diraster sekali ke buffer kecil 256×96, tiap kolom
dibaca ke bawah sampai piksel pertama yang tidak transparan, hasilnya profil tinggi yang
disimpan. Sekarang tiap pohon menanyakan tinggi bukit di titik x-nya sendiri — termasuk
ubin yang dicerminkan, yang tinggal membalik koordinat kueri. Jauh lebih waras daripada
mencoba mengevaluasi path yang panjangnya ratusan segmen bezier secara analitik.

**Batu gurun.** Ini salah baca gw. Di mockup, batu-batu itu bukan siluet yang berdiri di
tepi tanah — mereka **bercak gelap yang digambar di atas** bidang tanah, tergeletak di
lantai gurun. Waktu gw buang path tanahnya karena "tanah itu bagian gw", lantainya ikut
hilang dan batunya menggantung.

Perbaikannya bukan mengimpor balik tanah Figma-nya, melainkan memberi dataran jauh **garis
tanahnya sendiri**: satu jalur warna terdalam dataran itu dengan tepi bergelombang halus,
dan lapisan batunya digeser supaya separuh bawahnya mendarat di garis itu. Itu tanah, dan
tanah memang bagian gw.

| | nilai |
|---|---|
| gambar frame penuh, hijau | 0,180 ms |
| gambar frame penuh, gurun | 0,141 ms |
| profil siluet | 256 kolom, dihitung sekali per vektor |

---

## Langit prosedural sampai luar angkasa (12 Sep 2026)

Dari feedback: *"parallax itu ketika kita keatas ikut mengecil kebawah, mengikuti tanah,
kan itu tuh benda dibumi"*, dengan Golf Orbit sebagai acuan.

### Dua hal yang salah sebelumnya

**Parallax-nya tidak ikut mengecil.** Horizon-nya `H*0.55` plus 0,18 dari tinggi kamera,
dan **tidak ada satupun yang ikut zoom**. Pohon setinggi 400 meter di udara ukurannya sama
persis dengan waktu di landasan. Itu yang bikin dunianya terasa seperti latar lukisan, bukan
planet yang sedang ditinggalkan.

Sekarang horizon-nya adalah bidang permukaan dunia yang dilewatkan kamera — transform yang
sama dengan yang diterima tanah asli — diangkat sejauh jarak **dunia** yang tetap supaya
dataran jauh terbaca lebih jauh, bukan menimpa tanah dekat. Kedua sukunya membawa zoom, jadi
saat pod naik dan kamera mundur, seluruh lanskap mengecil dan merapat ke garis tanah.

**Langitnya digerakkan layar, bukan ketinggian.** Sekarang `skyAt(alt)` adalah fungsi dari
**tinggi dunia** di atas permukaan, dan gradiennya dibangun dengan mencuplik tiga belas
baris layar, mengubah tiap baris jadi ketinggian, lalu mencari warnanya. Jadi di landasan lu
lihat langit biome-nya sendiri, dan saat memanjat, hitamnya luar angkasa **turun masuk ke
layar dari atas** alih-alih seluruh latar berganti warna.

Pita ketinggiannya diukur dari apa yang benar-benar bisa dicapai game ini
(`node tools/flight-sim.mjs impact`):

| lv | apex |
|---|---|
| 1 PERFECT | 403px (50m) |
| 10 | 1464px (183m) |
| 20 | 3343px (418m) |

Jadi 3200px dipatok sebagai "setinggi yang game ini bisa", dan tangga di antaranya itulah
yang dibeli dengan upgrade. Bintangnya muncul dari ketinggian di **puncak layar**, bukan
dari jam, dan ditempatkan di ruang dunia dengan laju sangat lambat supaya terbaca sebagai
langit, bukan tempelan di viewport.

### Lengkung bumi, dan satu jebakan

Lengkungnya parabola, bukan lingkaran: selisihnya di bawah satu piksel selebar satu layar
pada sudut sekecil ini, dan ongkosnya satu perkalian per kolom alih-alih panggilan trigo.

Jebakannya: diambil apa adanya, horizon-nya **meluncur keluar dari bawah layar** saat apex.
Terukur di 1,15 kali tinggi layar pada busur Lv20, artinya planetnya hilang sama sekali —
persis satu hal yang perubahan ini justru ingin hindari. Sekarang ada clamp lunak: lewat 88
persen tinggi layar, horizon-nya cuma merayap, jadi tanahnya memadat ke tepi bawah dan
melengkung pergi alih-alih kabur.

### Yang sengaja TIDAK dilengkungkan: tanahnya sendiri

Tanah main digambar dari heightfield, dan `yAt` yang sama dipakai tabrakan, kerak, kawah dan
tunnel. Melengkungkan gambarnya saja berarti semuanya harus ikut dilengkungkan atau pod-nya
lepas dari tanah.

Gw ukur kasus terburuknya: pada busur Lv20, momen dengan tanah datar paling banyak terlihat
sambil lengkung masih kuat itu 283px tanah terlihat lawan lengkung 89px, di layar 816px.
Dan itu justru terbaca benar — tanah dekat memang tampak datar sementara horizon jauh
melengkung. Jadi dibiarkan.

| | nilai |
|---|---|
| skala lanskap, landasan ke apex Lv20 | 1,0 turun ke 0,28 |
| gambar frame penuh di permukaan | 0,170 ms |

### Tiga transisi yang diperbaiki

Feedback: *"masih aneh, transisinya"*. Diukur dengan menyapu lompatan antar-frame sepanjang
satu busur Lv20, bukan ditebak. Tiga penyebab, semuanya terukur.

**1. Tumbukan menyentak seluruh planet.** `onImpact` menyentak zoom kamera dari 0,28 ke
0,95 dalam satu frame — sengaja, supaya seluruh ladang bawah tanah tidak tersingkap
sekaligus. Tapi sejak latar ikut berskala dengan kamera, sentakan itu ikut menarik langit
dan lanskapnya. Terukur **+114px horizon dan −0,25 faktor angkasa dalam satu frame**.

Latar sekarang punya zoom sendiri (`cam.bz`) yang teredam menuju zoom kamera. Benda jauh
memang seharusnya menjawab gerak kamera lebih lambat — itu definisi parallax. Lompatan
zoom-nya turun dari 0,751 jadi 0,055 per frame.

**2. Gradien langitnya bergerigi.** Stop-nya dicuplik pada 13 jarak yang sama rata,
sementara `skyAt` itu linear sepotong-sepotong di antara tepi pita. Saat tinggi, satu layar
membentang ~2900px dunia, jadi 13 cuplikan jatuh tiap 224px dan **melewati tepi pitanya**.
Hasilnya gradien terpecah jadi lempeng-lempeng yang ikut menggeser saat kamera bergerak.

Stop-nya sekarang ditaruh **tepat di tepi pita**, jadi reproduksinya persis. Perlu diurutkan
dulu sebelum ditambahkan: ketinggian naik ke atas layar sementara offset gradien turun ke
bawah, jadi menyusuri pita menurut urutannya sendiri menyerahkan deret menurun ke
`addColorStop`.

**3. Atmosfernya berganti identitas dalam sepertiga detik.** Pita transisinya tetap 36 meter
di tiap sisi, dan angka itu dipilih untuk pod yang merangkak. Busur Lv20 menempuh 960m dalam
4,6 detik — **208 meter per detik** — jadi pita 72m itu dilewati dalam 0,35 detik dan
seluruh langit berganti warna di tengah penerbangan.

Lebarnya sekarang mengikuti jarak antar-tetangga, `min(150, gap * 0,45)`, jadi lebar di
tempat yang longgar dan tidak pernah cukup lebar untuk tumpang tindih:

| tepi | pita | detik di 208 m/s |
|---|---|---|
| 110m | 99m | 0,48 |
| 390m | 252m | 1,21 |
| 750m ke atas | 300m | 1,44 |

### Yang sebenarnya salah: periode ubin parallax ikut zoom

Feedback lanjutan: *"transisi parallaxnya, kenapa parallaxnya geraknya aneh dah"*. Bukan
warnanya — **gerakannya**. Dan ini bug beneran, bukan selera.

Periode ubin dihitung `tileW = sw / rate`, dengan `sw` itu lebar **layar** satu ubin — dan
lebar layar ikut zoom. Jadi periodenya ikut zoom. Indeks ubin `floor(wx / tileW)` berubah
setiap kali kamera zoom, artinya **bagian seni yang berbeda muncul di posisi dunia yang
sama**. Siluetnya merayap menyamping melewati dirinya sendiri sepanjang peluncuran, karena
zoom berjalan dari 1,0 ke 0,28.

Terukur di satu titik dunia tetap, x = 12345:

| zoom | sebelum | sesudah |
|---|---|---|
| 1,00 | ubin 1 pada 0,319 | ubin 1 pada 0,319 |
| 0,70 | ubin 1 pada 0,884 | ubin 1 pada 0,319 |
| 0,45 | ubin 2 pada 0,930 | ubin 1 pada 0,319 |
| 0,28 | ubin 4 pada 0,710 | ubin 1 pada 0,319 |

Periodenya sekarang `sw / (z * rate)` — zoom-nya dibagi balik keluar, jadi periodenya
murni jarak **dunia** dan konstan.

**Bug kedua di tempat yang sama:** laju mendatarnya tidak mengandung zoom. `sx = W/2 +
(wx - cam.x) * rate` berarti saat kamera mundur, gerak kamera yang sama mendorong
pemandangan sejauh yang sama di layar — padahal seharusnya lebih pendek. Sekarang
`* rate * z`, dan rentang layarnya `(W/2) / (rate * z)`. Koreksi yang sama dipasang di
sebaran pohon, batu dan goresan dataran.

Verifikasi: sepanjang satu busur Lv20, seni parallax sekarang bergeser **27,9px** per frame
saat kamera menempuh **27,8px**. Kelebihan 0,1px. Sebelumnya geserannya sama sekali tidak
terikat pada jarak tempuh kamera.

Uji terpisah: kamera x dan y dikunci, cuma zoom yang disapu 1,0 sampai 0,28. Puncak yang
sama tetap duduk di garis tengah di keenam zoom, cuma mengecil.

### Kedalaman: dari dua baris rata jadi tangga perspektif udara

Feedback: *"kurang depthnya sih parallaxnya, kurang enak dilihat kayak gambaran anak kecil"*.
Tepat, dan penyebabnya bisa disebutkan persis.

Yang ada sebelumnya dua baris punggungan, **masing-masing diisi satu warna rata**, dengan
satu pita kabut ditumpuk di atas keduanya. Siluet yang sama dua kali, tanpa gradasi nilai di
dalamnya. Itu memang bahasa rupa gambar anak-anak: bidang datar berkontur.

Kedalaman di lukisan datar itu **tangga**, dan semua sifatnya harus bergerak bersama di
tangga itu. Makin jauh berarti lebih kecil, lebih pucat, kontras lebih rendah, lebih lambat,
dan lebih berkabut. Sekarang empat baris dari dua path yang sama, tiap baris dengan
pudarannya sendiri — tanpa menambah satu byte pun seni baru.

| baris | laju | tinggi | fase ubin | kabut sesudahnya |
|---|---|---|---|---|
| 1 terjauh | 0,10 | 300 | 0,00 | 0,95 |
| 2 | 0,16 | 252 | 0,37 | 0,80 |
| 3 | 0,26 | 216 | 0,13 | 0,62 |
| 4 terdekat | 0,36 | 185 | 0,61 | 0,44 |

**Dua detail yang lebih menentukan daripada jumlah barisnya.**

Tiap punggungan diisi **gradien vertikal**, warna penuh di puncak dan hampir sampai ke warna
kabut di kakinya. Pudaran tunggal itulah perspektif udara, dan isian rata tidak bisa
memalsukannya. Itu perubahan terbesar dari semuanya.

Dan tiap baris dapat **fase ubin** sendiri. Empat baris dari dua path pada kelipatan yang
rapi akan menjajarkan puncaknya jadi satu sisir berulang begitu kamera bergerak; fase yang
berbeda membubarkannya.

| | nilai |
|---|---|
| gambar frame penuh, hijau | 0,146 ms |
| gambar frame penuh, gurun (path terberat, 4 baris) | 0,251 ms |
| seni baru ditambahkan | 0 |

---

## Tanah satu nada dengan latar + kabut kedua (12 Sep 2026)

Dua feedback: *"warna tanah itu harus satu tone dengan background"*, lalu *"diantara air dan
gunung itu harusnya ada gradient haze ini"* sambil menunjuk node `64:1046`.

### Tanahnya

`BIOMES` dan `ATMOSPHERES` ditulis terpisah — yang satu punya tanah dan mineral, yang satu
punya langit. Begitu latar mengisi seluruh layar, tanah cokelat di bawah pagi tosca terbaca
sebagai dua gambar yang ditumpuk.

**Percobaan pertama gagal, dan angkanya yang memberitahu.** Gw campur warnanya di RGB, 50%
menuju versi gelap dari dataran. Terukur selisih hue tanah lawan latar:

| | campur RGB | tint HSL |
|---|---|---|
| GREENLINE | 74° | 11° |
| SKYRIDGE | **174°** | 13° |
| SUNSCORCHED | 5° | 1° |
| VOLCANIC | 2° | 1° |

Gurun dan vulkanik "lolos" cuma karena palet tanahnya kebetulan sudah sewarna langitnya.
Yang dingin nyaris berlawanan. Sebabnya: mencampur di RGB tidak bisa membawa hue. Menggelapkan
target ke arah hitam justru mencabut saturasi yang seharusnya menarik hue-nya.

Sekarang `U.tint` bekerja di HSL dan eksplisit soal apa yang bergerak: **hue dan saturasi
berjalan menuju target, lightness tetap milik dasarnya.** Itu yang menjaga tanah tetap
terbaca sebagai tanah padat di bawah langit apa pun, bukan berubah jadi sepotong langit.
Hue ditarik 0,92 — di 0,8 rotasinya berhenti 36° kurang di SKYRIDGE, karena putaran yang
nyaris berseberangan cuma sampai sejauh itu pada 80%. Saturasi sengaja ditahan di 0,45.

**Bug di konversinya, ketemu karena diukur:** `hsl2rgb` menghitung `x` dari hue mentah.
Tint yang memutar lewat jalan terpendek rutin menghasilkan hue negatif, JS mempertahankan
tanda lewat operator `%`, dan salurannya keluar minus — terukur sekali sebagai
`rgb(-72,48,111)`. Sekarang `x` dihitung dari hue yang sudah dinormalkan, plus clamp.

### Kabut keduanya

Ini yang gw lewatkan waktu membaca mockup. Frame hijau punya **dua warna kabut**, bukan satu:
node `64:1074` mengabuti barisan jauh dengan mint yang lebih redup `rgb(148,225,205)`, dan
node `64:1046` mengabuti yang dekat dengan `rgb(159,255,209)` yang jauh lebih cerah. Gw
pakai satu untuk keduanya.

Yang dekat itulah yang dibaca mata sebagai gunung meleleh ke air — puncaknya mendarat tepat
di tepi atas air — dan di mockup opasitas puncaknya **penuh**. Punya gw cuma 0,44 di lapisan
terakhir, jadi kaki punggungannya duduk keras di garis air alih-alih larut ke dalamnya.

Sekarang tiap atmosfer punya `haze` dan `haze2`, dicampur sepanjang tangga kedalaman, dan
opasitas lapisan terdekat naik ke 0,92.

### Koreksi: label `build:` gw memang basi

Gw dua kali bilang baris `build:` di panel debug itu cara tercepat memastikan versi yang
kebuka. Ternyata setiap kali gw menggantinya, gw **menebak** nilai lamanya dan `replace`-nya
gagal diam-diam tanpa error. Labelnya menyangkut di `12 Sep · journey atmosphere` selama
banyak putaran. Sekarang diganti dengan membaca nilai yang ada lewat regex, bukan menebaknya.

---

## Pergantian stage: cross-fade, bukan potong (12 Sep 2026)

Feedback: *"kenapa ketika transisi stage, gunungnya itu transisinya aneh, kayak dari bawah
terus gunungnya turun naik"*. Diukur dengan menyapu melewati batas 390m dan mencatat apa
yang berubah, bukan ditebak.

Hasilnya tepat satu meter:

| di 390m | dari | ke |
|---|---|---|
| seni punggungan | `greenFar` | `desertFar` |
| pita bukit | ada | hilang |
| lapisan batu gurun | tidak ada | muncul |

Jadi **warnanya memudar selama 252 meter sementara BENTUKNYA memotong dalam satu meter**,
tepat di tengah pudaran itu. Garis tanah jauh melompat dari pita bukit di `horizon + 231k`
ke garis tanah gurun di `horizon + 150k` — sekitar 80px tegak dalam satu frame. Itulah
"turun naik"-nya.

Sebabnya: `atmosphereAt` mencampur warna, tapi semua yang **struktural** — path gunung mana,
apakah stage ini punya pita bukit atau lapisan batu — diambil utuh dari satu sisi lewat
`t < 0.5 ? prev : next`. Bentuk memang tidak bisa diinterpolasi.

Sekarang skyline-nya dipecah jadi `drawStack(pal)` yang bisa dipanggil dengan palet mana
pun, dan sepanjang pita transisi **dua stage digambar lalu dilarutkan**. Stage yang keluar
dilukis penuh dulu supaya tutupannya selalu utuh — dua stack setengah tembus akan
membocorkan langit di antaranya — lalu stage yang masuk digambar ke lapisan scratch dan
ditumpuk pada alpha `t`.

Dilarutkan lewat **lapisan**, bukan `globalAlpha`, karena stack-nya mengatur alpha-nya
sendiri di dalam untuk kabut dan overlay; lapisan satu-satunya cara memudarkan hasilnya
sebagai satu gambar.

### Terukur

Lompatan warna per satu meter perjalanan, dijumlahkan atas 24 baris × 3 kanal, di tiap batas
stage:

| batas | 110m | 390m | 750m | 1110m | 1810m | 2610m |
|---|---|---|---|---|---|---|
| lompatan | 26 | 133 | 12 | 20 | 40 | 17 |

Yang di 390m masih paling besar karena di sanalah dua keluarga seni yang benar-benar berbeda
bertemu, tapi 133 atas 72 nilai sampel itu di bawah dua per kanal — gradien, bukan potongan.

| | nilai |
|---|---|
| gambar frame penuh, tanpa pudaran | 0,228 ms |
| gambar frame penuh, di tengah cross-fade | 0,253 ms |

---

## Gunung raksasa itu: skala barisan, bukan landmark (12 Sep 2026)

Feedback: *"itu apaan jing gunung besar, kayaknya bekas buatan lu dah, hapus"*.

### Tebakan pertama gw salah

Gw kira itu sistem `landmarks` — siluet besar yang digambar sendiri di belakang parallax.
Gw hapus, lalu render ulang: **gunungnya masih ada**. Bukan itu.

### Yang sebenarnya

Diukur, di layar 459×816:

| baris punggungan | tinggi | lebar ubin |
|---|---|---|
| 1 terjauh | 272px (33% layar) | 3,45 lebar layar |
| 2 | 228px | 2,90 |
| 3 | 196px | 2,61 |
| 4 terdekat | 168px | 2,24 |

Tiap ubin dua sampai tiga setengah kali lebar layar, jadi **yang pernah terlihat cuma
sepertiga dari satu barisan**. Ditambah baris terjauh bergerak pada laju 0,10 — nyaris diam
— hasilnya satu puncak setinggi sepertiga layar berdiri tak bergerak di langit. Itu bukan
barisan gunung, itu satu gunung raksasa yang diparkir.

Akarnya lagi-lagi portrait. Tinggi 284 dan 195 itu benar untuk frame landscape 1600×900 di
mana satu ubin memenuhi seluruh lebar dan yang terlihat adalah barisan berisi banyak puncak.
Dipindah dengan porsi tinggi yang sama ke kolom portrait, lebarnya meledak.

Sekarang barisannya diperkecil ke 150/128/108/92 pada frame 900, yang jadi 17/14/12/10
persen tinggi layar dan **1,1 sampai 1,7 lebar layar per ubin**. Lima sampai tujuh puncak
terlihat sekaligus — komposisi yang memang dipunyai mockup-nya.

### Landmark tetap gw buang

Diagnosis awalnya salah, tapi keputusannya bertahan. Di setiap titik yang gw sampel,
landmark-nya tertutup habis oleh tumpukan punggungan — tidak kelihatan sama sekali. Dan
sekarang setelah punggungannya diperpendek, mereka justru akan muncul: sembilan siluet
bertepi keras tanpa kabut, di skala yang beda dari semua yang lain. Sistemnya dihapus,
112 baris, termasuk `drawLandmark`. Gampang dikembalikan kalau ternyata mau.

| | nilai |
|---|---|
| gambar frame penuh di permukaan | 0,090 ms (dari 0,228) |
| baris terhapus | 112 |

---

## Pad bisa pindah (13 Sep 2026) — dari ide *"stagenya unlock gitu, gak langsung pindah"*

Ide asalnya dari Space Frontier 2: stage yang dibuka satu-satu, bukan dunia yang dilewatin
sekali terus ditinggal. Tapi struktur SF2 nggak bisa ditiru mentah — di sana tiap *system*
itu arena terpisah, sementara dunia ini satu garis lurus 4200m di mana ASHFALL secara fisik
ada **di belakang** semua yang lain. Yang diambil idenya, bukan strukturnya: **checkpoint**.

### Kenapa ini perlu

Dihitung dari pad rumah, POWER yang dibutuhin buat nyampe tiap atmosphere:

| stage | jarak | POWER | total koin |
|---|---:|---:|---:|
| skyridge | 96m | 1 | 0 |
| sunscorched | 376m | 10 | 8rb |
| twilight | 736m | 17 | 81rb |
| volcanic | 1096m | 23 | 638rb |
| ashfall | 1796m | 31 | **10,5 juta** |
| anomaly | 2596m | 40 | **246 juta** |

Satu run di sekitar 1000m bayar ~440 koin. Artinya ANOMALY itu kira-kira setengah juta run.
Dua dari tujuh atmosphere — lengkap sama palet, haze, vector, bintang — praktis nggak akan
pernah kelihatan. Itu bukan progression, itu konten mati.

Diukur dari pad ke pad, tangga yang sama jadi **POWER 5, 5, 10, 10, 16, 18**.

### Yang dipisah: `CFG.PAD_X` lawan `Game.padX`

Ini bagian yang paling gampang dirusak. `CFG.PAD_X` itu **titik nol koordinat "meter
tempuh"** — SITES, marker 100m, `World.xOf`/`mOf`, `tools/check-layout.mjs` dan
`Tools/refgen.mjs` semuanya diauthor relatif ke situ. Kalau dia dipakai ulang jadi "di mana
run ini mulai", seluruh tabel site bergeser tiap kali pemain ganti pad.

Jadi dia **nggak disentuh**. Yang baru `Game.padX`, cuma soal di mana pod berdiri.

### Dua jarak, dan bedanya penting

```
d   = (pod.x - Game.padX) / M     jarak dari PAD ini
abs = World.mOf(pod.x)            posisi absolut di dunia
```

`d` yang dipakai buat bayaran, BEST, dan countdown rekor — itu yang dicapai peluncurannya,
dan tetep sebanding dari pad mana pun. `abs` yang dipakai buat site, atmosphere, readout
NEXT, dan unlock pad. Kalau bayaran pakai `abs`, berangkat dari pad ANOMALY terus diem aja
langsung dibayar `14*sqrt(2650)` = 720 koin. Makanya dipisah.

Di save juga dipisah: `best` itu rekor sekali lompat, `reach` itu titik terjauh yang pernah
disentuh. Cuma `reach` yang jadi gerbang.

### Posisi pad diauthor, bukan dihitung

Tujuh angka, ditaruh manual di `PADS` (js/world.js), dalam meter tempuh:
`0, 215, 430, 800, 1180, 1850, 2650`.

Tiga syarat yang harus dipenuhi sekaligus, dan ketiganya udah dicek pakai skrip:

1. **Bersih dari pita near-miss tiap landing zone.** Pad meratain tanah di sekitarnya; kalau
   nimpa site, mangkuk yang site itu butuhin ikut rata. Kandidat pertama (`from + blendHalf`)
   naruh pad SUNSCORCHED persis di dalam zona GIANT SKELETON.
2. **Lewat dari pita cross-fade warna stage-nya sendiri**, biar nggak mulai di tengah transisi.
3. **Meleset dari semua titik sampel `Tools/refgen.mjs`.** Ini yang paling nggak kelihatan:
   meratain tanah ngubah `hs`, dan kalau kena titik yang dipakai test fidelity Unity, semua
   referensinya harus digenerate ulang. Dengan posisi sekarang `hs[0,1,10,100,500,1000,2000]`
   dan `yAt(0,110,500,1000,4200,9000)` semuanya **sama persis** — udah diverifikasi.

Perataan sendiri: rata di ±14m, lalu `U.smooth` balik ke tanah asli sampai ±42m, dikerjain
**sebelum** mangkuk zona dicarve biar site selalu menang kalau keduanya ketemu.

### UI

Bar pemilih pad muncul di atas bar upgrade, dan **sembunyi sendiri selama baru satu pad
kebuka** — pemilih dengan satu pilihan cuma bikin berantakan. `--bar-h` tetep tinggi bar
upgrade doang (bar pad numpuk di atasnya lewat CSS, jadi kalau dijumlah bakal circular);
tinggi totalnya dipublish terpisah ke `--pad-h` dan `Game.bottomUI`, yang dipakai meter
canvas sama hint TAP TO LAUNCH biar nggak ketimpa.

### Yang belum

Belum diport ke Unity. Site masih diauthor buat dunia tanpa pad — beberapa sekarang deket
banget sama pad, dan celah antar pad belum dipass ulang. Dan POWER ganti peran: dia berhenti
jadi gerbang seluruh dunia, jadi level tinggi butuh alasan lain (IMPACT dan DRILL).

---

## Tanah ditinggal pas naik (13 Sep 2026) — dari feedback *"tanah itu tidak ikut keatas, tetap dibawah"*

Keluhannya tepat, dan kelihatan di angka. Diukur dari peluncuran sampai apex (217m naik),
posisi tanah di layar cuma jalan segini:

```
alt   20px   tanah 66% layar
alt  411px   tanah 71%
alt  955px   tanah 87%
alt 1360px   tanah 96%   <- mentok
alt 1734px   tanah 87%   <- balik naik lagi
```

Jadi setelah sekitar 100m, naik 100m lagi nggak ngubah apa-apa di layar. Tanahnya bukan
ketinggalan di bawah — dia ikut jalan bareng pod. Itu yang bikin ketinggian nggak kerasa
sebagai "ninggalin tempat", cuma kayak latar yang diseret.

Dua penyebabnya, dan dua-duanya sengaja dulu.

### 1. Kamera cuma ngikutin 55% pendakian

```js
c.y = damp(c.y, p.y * (0.55 - fall*0.2) + (gy - 120) * (0.45 + fall*0.2), 4.2, dt);
```

Bobot 0.55 di pod itu artinya tanah mundur cuma setengah laju pod naik. Komentarnya bilang
"CLIMBING: pull back so the arc and its apex are both visible" — dan itu emang ngasih lihat
busurnya, tapi harganya tanah nempel terus.

Sekarang `0.90 - fall*0.55`. Pas naik, kamera nempel ke pod. Pas turun, `fall` ngebalikin
framingnya ke tanah — dan cepat: setengah detik jatuh udah `vy` 700, yaitu `fall` 0.5. Jadi
framing impact yang lama (titik tabrakan kelihatan jauh sebelum kena) nggak hilang.

### 2. `horizonAt` dipatok di 0.88 layar

```js
const cap = H * 0.88;
return raw <= cap ? raw : cap + (raw - cap) * 0.12;
```

Ini gw sendiri yang nambahin, alasannya ditulis di komentar: *"taken literally it slides
clean off the screen at apex and the planet vanishes"*. Ternyata itu keputusan yang salah —
"planet-nya hilang" justru yang dicari. Dan ada alasan teknis juga: terrain asli digambar di
world space **tanpa** cap sama sekali, jadi matok salah satunya doang bikin parallax dan
tanah asli pisah jalan. Cap-nya dicabut, sekarang dua-duanya gerak bareng.

### Hasil

```
         tanah   horizon
alt  955px   87%    87%
alt 1360px   96%    96%
alt 1627px  103%   101%   <- lewat bawah layar
APEX        108%   104%   <- langit doang
turun        96%    93%
turun        79%    75%
turun        61%    57%
```

Di apex layarnya langit gelap sama bintang doang. Pas turun tanah balik naik ke frame tepat
waktu. State lain nggak kesenggol: `ready` 55%, `penetrate` 53%, `drill` -285% (horizon jauh
di atas layar, wajar, lagi di bawah tanah).

---

## Masuk ke bawah tanah: dorong, bukan potong (13 Sep 2026) — dari feedback *"tiba tiba ngezoom terus muncul barang barang dibawah tanahnya"*

Dua hal jatuh di frame yang sama persis, dan dua-duanya keukur:

```
terbang    zoom 0.40   mineral 0
impact+0   zoom 1.04   mineral 155
```

**Zoom 0.40 ke 1.04 dalam satu frame** (2,6x), dan di frame itu juga seluruh lapangan gali
— 155 mineral, batunya, garis bedrock — muncul jadi sekaligus. Lompatan sebesar itu bukan
pukulan, itu sambungan film.

### Kenapa dulu begitu

Snap zoom-nya sengaja, dan komentarnya jujur soal alasannya: damping dari 0.3 ke framing
penetrasi makan setengah detik, dan selama setengah detik itu seluruh lapangan kepampang di
layar sekaligus. Jadi zoom-nya dipaksa loncat biar nutupin.

Itu nambal gejala. Yang sebenernya salah adalah **lapangannya digambar penuh begitu dibuat**.

### Yang diubah

`CFG.UG_REVEAL_T` (0,30 detik) — lapangan bawah tanah memudar naik, bukan nongol.
`Game.ugReveal` jalan pakai **waktu game**, bukan waktu nyata, jadi hitstop ikut ngebekuin:
frame beku pas kontak nahan permukaan persis kayak sebelumnya, dan lapangannya baru dateng
setelah dunia gerak lagi.

Ada dua `globalAlpha` di dalam `drawUnderground` (0.38 buat dinding, 0.13 buat kerikil) yang
nimpa alpha luar kalau dibiarin — dua-duanya sekarang dikali `rv`.

Dengan reveal-nya beres, snap zoom-nya nggak perlu lagi. Sekarang tinggal `tzoom = 1.55`
terus kamera jalan sendiri. Sisa lompatannya 0.40 ke 0.58 di frame pertama, itu pun ketutup
kilatan putih yang jatuh di frame yang sama.

### Hasil

```
impact+ 0   zoom 0.58   reveal 0.00
impact+10   zoom 0.63   reveal 0.02     <- hitstop nahan
impact+26   zoom 0.95   reveal 0.15
impact+46   ...         lapangan udah kebaca
```

Reveal penuh di 1,18 detik nyata; kendali baru pindah ke pemain di 3,20 detik. Jadi
lapangannya udah jelas jauh sebelum dibutuhin. Tiga run penuh dari dua pad berbeda: nol error.

---

## Cross-fade parallax: warna jangan ikut dicampur (13 Sep 2026) — dari feedback *"bertumpuknya aneh, kadang beda beda warna, ada komponen aneh"*

Screenshot-nya nunjukin gunung biru sama pinus hijau nangkring di tengah gurun SUNSCORCHED.
Bukan komponen nyasar — itu stack SKYRIDGE yang lagi ditinggalin, kegambar di bawah stack
gurunnya.

### Bug-nya satu baris

```js
this.drawStack(ctx, cam, W, H, b.prev);     // <- atmosphere MENTAH
this.drawStack(lx,  cam, W, H, b.next);     // <- atmosphere MENTAH
```

`pal` — palet yang warnanya udah dicampur — dihitung di baris sebelumnya terus **dibuang**.
Tiap separuh digambar pakai warnanya sendiri. Jadi pas nyebrang, yang di-cross-fade bukan
cuma bentuknya, tapi warnanya juga.

Diukur di 433m tempuh: itu 82% jalan di blend skyridge→sunscorched, jadi SKYRIDGE masih
kegambar 18% di bawah gurun. Biru 18% di atas oranye bukan bayangan tipis — biru lawan
oranye itu komplementer, jadi kebacanya pemandangan utuh dari biome yang salah. Persis kayak
yang kelihatan.

Dibuktiin dengan A/B: matiin `drawParallax` → gunung biru sama pinusnya ilang, yang tersisa
cuma jembatan, kaktus, marker, sama site GIANT SKELETON (semuanya world-space, dan bener).

### Dua hal yang nyebrang, dan nggak boleh jalan bareng

**WARNA** harusnya nge-blend sepanjang pita penuh — 252m buat gurun — karena pergeseran
atmosfer yang pelan itu emang tujuannya. **BENTUK** nggak bisa diinterpolasi sama sekali:
jalur gunung mana yang dipakai, dan stage ini punya pita bukit atau lapisan batu gurun, itu
pilihan antara dua set art.

Sekarang dua-duanya ambil palet campuran yang SAMA, dan cuma beda di art mana yang ditunjuk:

```js
const shaped = (side) => Object.assign({}, pal, {
  vecFar: side.vecFar, vecMid: side.vecMid, vecHill0: side.vecHill0, ...
});
```

Palet nggak pernah dicampur sama dirinya sendiri lagi, dan yang memudar cuma siluetnya.

Bentuknya juga tukeran di **jendela pendek di tengah** blend warna (`t` 0.40–0.60), bukan
sepanjang pita. Di luar jendela itu, persis satu skyline yang digambar. Hasilnya jendela
tukar bentuk tinggal 40–50m raw di tiap batas, dari yang tadinya 100–300m.

### Hasil

```
350m  bentuk 0.00   bukit skyridge, tapi warnanya udah hangat
365m  bentuk 0.20   bukit mulai larut, mesa mulai muncul
380m  bentuk 0.65   mayoritas mesa
395m  bentuk 1.00   gurun murni
433m  bentuk 1.00   gurun murni  <- yang tadinya biru
```

### Yang BELUM dibenerin

Masih ada barel hijau sama jembatan biru di sekitar raw 400m. Itu bukan parallax — itu
`World.props` sama art site yang diauthor, dan batas biome-nya potong keras di raw 400
sementara palet-nya nge-blend di 340–460. Masalah terpisah, belum disentuh.

---

## Lengkung bumi muncul kepagian (13 Sep 2026) — dari feedback *"kenapa ada haze yang membulat ketika keatas"*

Yang membulat itu `droop` — parabola yang bikin cakrawala melengkung, dikali `spaceT`.
Bukan haze, tapi tepi atas pita plain sama hazenya ikut kebentuk.

### Kenapa kepagian

`spaceT` dihitung dari ketinggian **tepi atas layar**:

```js
const altTop = CFG.SURFACE_Y - worldAt(0);        // worldAt(0) = cam.y - (H*anchor)/bz
const space  = clamp((altTop - 900) / 2300, 0, 1);
```

`(H*anchor)/bz` itu sekitar 1700px sendirian begitu kamera nge-zoom out. Jadi `altTop`
ketambahan segitu tanpa pod-nya naik sama sekali. Setelah kamera diubah biar nempel ke pod
(lihat bagian sebelumnya), `altTop` naik dua kali lebih cepat dan faktornya saturasi kepagian.

Diukur di arc POWER 12 (apex cuma 221m):

```
state            camY     bz   lengkung
lepas landas       54   1.02        0px
apex            -1400   0.29      218px   <- kubah penuh, seperempat tinggi layar
abis impact        58   0.91        0px
```

218px di arc biasa. Itu yang kelihatan.

### Yang diubah

Lengkung dikasih faktornya sendiri, `curveT`, dan inputnya ketinggian **kamera** — bukan
tepi layar. Kamu cuma lihat planet melengkung kalau KAMU yang tinggi:

```js
this.curveT = U.clamp((CFG.SURFACE_Y - cam.y - 1600) / 2600, 0, 1);
```

`spaceT` dibiarin apa adanya buat bintang, jadi bintangnya nggak ikut mundur.

```
POWER  4   apex  86m   lengkung 0px
POWER  8   apex 145m   lengkung 0px
POWER 12   apex 221m   lengkung 0px
POWER 20   apex 419m   lengkung 101px
POWER 30   apex 756m   lengkung 192px
```

### Tapi ada konsekuensi yang belum diputusin

Karena tanah sekarang jatuh keluar layar pas naik, lengkungnya nyaris nggak punya panggung.
Di-scan sepanjang arc, frame di mana horizon MASIH di layar dan lengkungnya lebih dari 4px:

```
POWER 12   tidak pernah
POWER 20   maks 11px  (horizon di 97% layar)
POWER 30   maks 16px  (horizon di 98%)
POWER 45   maks 17px  (horizon di 98%)
```

17px di tepi paling bawah layar itu praktis nggak kelihatan. Dua permintaan kemarin —
"tanah tetap dibawah" dan "lengkungnya jangan muncul" — sama-sama bener, tapi digabung
artinya lengkung bumi nggak punya tempat buat tampil lagi.

### Jadi dihapus

Alasan yang diputusin: *"jangan bikin planet melengkung, karena itu bikin susah, semuanya
harus ikut melengkung."* Itu memang inti masalahnya. Cakrawala melengkung itu all-or-nothing
— tanah asli, props yang berdiri di atasnya, site, dan marker 100m semuanya digambar di
world space dan harus ikut membengkok dengan besaran yang sama biar nyambung. Mbengkokin
latarnya doang itu yang bikin kebacanya kubah nangkring di belakang dunia datar, bukan planet.

Yang dilepas dari `drawStack`:

| dulu | sekarang |
|---|---|
| `this.curveT = ...` di `drawSky` | dihapus |
| `const curve` + `droop(sx)` | dihapus |
| `curvedFill` (tepi atas ngikutin busur) | `fillBelow` — `fillRect` biasa |
| `top = topY + droop(...)` di `band()` | `top = topY` |
| garis tanah gurun `+ droop(sx)` | tinggal gelombang sinusnya |

`this.spaceT` ikut dihapus juga: satu-satunya pembacanya itu si lengkung, jadi begitu
lengkungnya pergi dia cuma ditulis dan nggak pernah dibaca. Bintang nggak kesenggol —
dia pakai variabel lokal `space`, bukan field-nya.

Empat state dites (P12/P20/P30 di udara, plus satu run penuh dari pad SUNSCORCHED): nol error,
cakrawala lurus di semua ketinggian.
