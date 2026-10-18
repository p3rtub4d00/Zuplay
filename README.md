# ZUPLAY

PWA pessoal de vídeos e músicas com interface roxa/ciano, busca do YouTube, player incorporado, fila, playlists, favoritos e histórico. Sem pagamentos.

## Executar localmente

1. Instale Node.js 20 ou superior.
2. Execute `npm install`.
3. Defina `YOUTUBE_API_KEY` no ambiente ou em arquivo `.env` local (nunca envie a chave ao GitHub).
4. Execute `npm start` e abra http://localhost:3000.

## Render

Use **New > Blueprint** e selecione este repositório para ler o `render.yaml`, ou crie um Web Service Node com build `npm install`, start `npm start`, health check `/health`. Adicione `YOUTUBE_API_KEY` em **Environment** e faça o deploy. A porta é configurada automaticamente pelo Render.

## Google Cloud

Ative **YouTube Data API v3** no projeto Google Cloud e crie uma chave de API. Restrinja a chave à API e, quando aplicável, ao servidor que fará as chamadas. A busca é feita no backend para não expor a chave no JavaScript público.

## Observações

- Playlists, favoritos e histórico são salvos apenas no navegador deste dispositivo (`localStorage`), sem sincronização entre aparelhos.
- Vídeos são exibidos pelo player incorporado oficial do YouTube. Anúncios, disponibilidade de incorporação e restrições de segundo plano dependem do YouTube.
- O aplicativo não bloqueia anúncios, não baixa vídeos e não contorna restrições de reprodução.
- O layout usa miniaturas oficiais retornadas pelo YouTube; nenhuma imagem de artistas é armazenada no repositório.
- Para instalar no Android, abra o site via HTTPS e escolha **Instalar aplicativo** no menu do navegador.
