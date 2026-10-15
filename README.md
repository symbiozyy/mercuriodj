# Mercúrio · Progressive / Psytrance

Site oficial do **Mercúrio**, projeto de progressive / psytrance de Gilliard Rocha (zona leste de São Paulo).
Booking direto pelo WhatsApp (11) 94053-0379 · djm3036@gmail.com · [@_mercuriodj](https://instagram.com/_mercuriodj).

## Estrutura

- `index.html` — página única (hero, release/bio, set do SoundCloud, vídeos, o som (progressive 145 BPM), gigs, galeria, booking, press kit)
- `assets/css/style.css` — identidade visual cyberpunk (neon ciano/violeta/magenta do logo, HUD, scanlines, glitch)
- `assets/js/main.js` — intro de boot (entra com som), grid neon do hero, player do SoundCloud com fade, vídeos (local + Google Drive), idioma PT/EN, lightbox, pedido de booking pelo WhatsApp
- `assets/video/` — vídeo de release (H.264) e loop do hero
- `assets/img/` — fotos, frames do vídeo, logo e símbolo
- `assets/press/` — arquivos para download no press kit

## Trocar o set do site

O site entra sempre com som: o botão "Entrar" da intro só libera quando o set está carregado,
para o play acontecer no próprio clique (senão o navegador bloqueia o áudio).

Em `assets/js/main.js`, `PROFILE_URL` é o perfil cujas faixas aparecem na lista "Todos os sets"
e `FEATURED` é parte do título do set que abre e toca ao entrar (hoje `"The Next Chapter"`).

## Vídeos do Google Drive

Na seção de vídeos do `index.html`, cada `<article class="reel reel--drive" data-drive="...">` recebe o link
de compartilhamento do Drive. O arquivo precisa estar como **"Qualquer pessoa com o link"**.
Para mais vídeos, copie o bloco e troque o link. A música do site abaixa quando o vídeo é aberto
e volta ao clicar em "parar".

## Publicar no GitHub Pages

Settings → Pages → *Deploy from a branch* → `main` / `(root)`.
O site fica em `https://symbiozyy.github.io/mercuriodj/`.

## Rodar localmente

```sh
python3 -m http.server 8000
```
