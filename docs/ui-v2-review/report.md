# VisionID Modern UI v2 Final Visual Review

Ngay chup: 2026-07-31

Branch: `feature/visionid-modern-ui-v2`

Trang thai: chua commit, chua push, chua deploy. Vong nay chi polish CSS, capture script va screenshot/report. Khong doi JS nghiep vu, workflow, camera lifecycle, MediaPipe, classifier, backend, localStorage hay privacy payload.

## Nguon chup

- Current app: `http://127.0.0.1:5173/frontend/`
- Before comparison: `http://127.0.0.1:5174/frontend/`
- Desktop: `1440x900`, `1366x768`
- Mobile portrait: `390x844`, `360x800`
- Mobile landscape: `844x390`
- iPad portrait approximation: `768x1024`
- Du lieu: fake QA data trong Chrome user-data-dir tam thoi.

## File da sua/them

- `frontend/css/styles.css`
- `frontend/index.html`
- `tools/capture-ui-v2-review.mjs`
- `tools/static-preview-server.mjs`
- `docs/ui-v2-review/*`

## Screenshot paths

- `docs/ui-v2-review/desktop-visionid.png`
- `docs/ui-v2-review/desktop-consultation.png`
- `docs/ui-v2-review/mobile-profile.png`
- `docs/ui-v2-review/mobile-visionid.png`
- `docs/ui-v2-review/mobile-visionid-scanning.png`
- `docs/ui-v2-review/mobile-consultation.png`
- `docs/ui-v2-review/mobile-visionid-landscape.png`
- `docs/ui-v2-review/before-desktop-profile.png`
- `docs/ui-v2-review/after-desktop-profile.png`
- `docs/ui-v2-review/mobile-visionid-before.png`
- `docs/ui-v2-review/mobile-visionid-before-after.png`
- `docs/ui-v2-review/capture-results.json`

## Desktop Header Truoc/Sau

| Metric | Truoc pass compact | Sau final polish | Ket qua |
|---|---:|---:|---|
| Desktop VisionID camera top | `335.3px` | `271.3px` | Len cao hon khoang `64px`. |
| Desktop VisionID header height | khoang `291.8px` | `241.3px` | Giam khoang `50.6px`. |
| Desktop VisionID customer session height | `87px` | `79px` | Gon hon, van giu thong tin chinh. |
| Desktop 1366 camera top | chua do truoc | `269.8px` | Khong overflow, camera van du rong. |
| Sidebar width | `260px` | `260px` | Khong regression. |

Polish da lam:

- Page header desktop VisionID nho gon hon.
- Eyebrow trong page header giam visual weight de sidebar la brand chinh.
- Confirmation banner va customer session giam padding/min-height.
- Cac chip trong header nho hon va bot canh tranh thi giac.

## Consultation Readability

- Body text trong recommendation/inspector/summary panel dat muc doc de hon: `14px`, line-height `1.58`.
- Giam cam giac technical uppercase bang cach ha letter spacing/text-transform o mot so label phu.
- Tang khoang cach trong command strip va action panel.
- Khong thay noi dung tu van, ranking, classifier hay recommendation data.
- Panel ben phai khong lam camera hep hon; desktop camera van `713x445.6px` o viewport `1440x900`.

## Mobile Action Tray Truoc/Sau

| Metric | Truoc final polish | Sau final polish | Ket qua |
|---|---:|---:|---|
| Mobile VisionID action tray height `390x844` | `166px` | `122px` | Gon hon `44px`. |
| Primary CTA | full-width | full-width | `Bat camera` ro nhat. |
| Secondary CTA | 2 cot, de nang visual | 3 cot can doi | `Tai anh`, `Phan tich`, `Tu van thu cong` cung 1 hang. |
| Disabled button weight | hoi nang | opacity/box-shadow giam | Disabled khong canh tranh voi CTA active. |
| Touch target | >=44px | >=46px secondary, 50px primary | Dat. |
| Mobile action bar tren VisionID | hidden | hidden | Khong che camera. |

O viewport `360x800`, action tray cao `176px` vi nut phu can wrap de khong cat chu; van khong horizontal overflow va khong cut text.

## Mobile Camera Card

- Portrait `390x844`: camera panel `370x430px`, top `213px`, bottom `643px`; nam trong first viewport.
- Action tray `390x844`: top `651px`, bottom `773px`; khong overlap camera.
- Privacy strip nam trong card, khong bi cat trong anh `mobile-visionid.png`.
- Scan HUD cach privacy strip hon (`bottom: 78px`) de hai lop thong tin khong chen nhau.
- Video/canvas alignment: `videoCanvasSameCssBox=true` trong tat ca metrics co camera.
- Khong doi video/canvas transform, object-fit, mirror hay lifecycle JS.

## Cut Text Result

| Viewport / man hinh | cutTextCount |
|---|---:|
| Desktop VisionID `1440x900` | `0` |
| Desktop VisionID `1366x768` | `0` |
| Mobile Profile `390x844` | `0` |
| Mobile Consultation `390x844` | `0` |
| Mobile VisionID `390x844` | `0` |
| Mobile VisionID landscape `844x390` | `0` |
| Mobile Profile `360x800` | `0` |
| Mobile VisionID `360x800` | `0` |
| iPad Portrait VisionID `768x1024` | `0` |

Da xu ly cut text bang line-height, wrapping, min-width va grid responsive. Khong dung ellipsis/overflow hidden cho noi dung nghiep vu quan trong.

## Responsive QA

| Viewport | Horizontal overflow | Cut text | Camera/action result |
|---|---:|---:|---|
| `1440x900` desktop VisionID | false | 0 | Camera top `271.3px`, actions bottom `794.9px`. |
| `1366x768` desktop VisionID | false | 0 | Camera top `269.8px`, actions bottom `767.8px`. |
| `390x844` mobile portrait VisionID | false | 0 | Camera/action tray nam trong first viewport. |
| `360x800` mobile portrait VisionID | false | 0 | Camera trong first viewport; action tray bottom `827px`, can cuon nhe cho nut cuoi. |
| `844x390` mobile landscape VisionID | false | 0 | Camera top `157px`, gan tron viewport; actions nam ngay duoi camera. |
| `768x1024` iPad portrait VisionID | false | 0 | Camera top `289px`, bottom `809px`; action tray bottom `947px`. |

Ghi chu: metric `mobile360Consultation` trong capture script khong chuyen sang tab Tu van vi mobile CTA dang bi khoa theo workflow headless o thoi diem do; screenshot `mobile-consultation.png` tai viewport `390x844` van la man Tu van va pass cut/overflow.

## Camera/Video/Canvas Alignment

- `desktopVisionid.videoCanvasSameCssBox=true`
- `desktop1366Visionid.videoCanvasSameCssBox=true`
- `mobileVisionid.videoCanvasSameCssBox=true`
- `mobileVisionidLandscape.videoCanvasSameCssBox=true`
- `mobile360Visionid.videoCanvasSameCssBox=true`
- `ipadPortraitVisionid.videoCanvasSameCssBox=true`

Headless khong co camera that nen `videoReady=false`. Can manual QA camera that de xac nhan live scan, nhung CSS pass nay khong doi camera JS.

## Console Errors

Chi con 1 low issue trong local static server:

- `GET /favicon.ico` 404

Khong phat hien console error moi lien quan app/camera.

## Loi Con Mo

- Chua xac minh live camera bang thiet bi that trong vong nay.
- Chua xac minh Safari iPhone/iPad upload fallback tren thiet bi that.
- `360x800` VisionID action tray can cuon nhe sau camera, chap nhan duoc vi khong overlap/cut text.
- Local static preview co `favicon.ico` 404, khong anh huong nghiep vu.

## Trang Thai

`Ready to commit` sau khi review visual lan cuoi, voi dieu kien manual QA camera/iOS fallback duoc thuc hien rieng tren thiet bi that.
