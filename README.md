# ZUPLAY

PWA pessoal de vídeos e músicas com interface roxa/ciano, busca do YouTube, player incorporado, fila, playlists, favoritos e histórico. Sem pagamentos.

## Executar localmente

1. Instale Node.js 20 ou superior.
2. Execute `npm install`.
3. Execute `npm start` e abra http://localhost:3000.

## Render

Use **New > Blueprint** e selecione este repositório para ler o `render.yaml`, ou crie um Web Service Node com build `npm install`, start `npm start`, health check `/health`. Não é necessário configurar chave da API oficial do YouTube. Faça o deploy. A porta é configurada automaticamente pelo Render.

## Pesquisa de vídeos

A busca utiliza a biblioteca não oficial `youtube-search-api`, assim como o Contêiner Music. Essa integração pode deixar de funcionar se o YouTube alterar suas páginas ou mecanismos internos. A reprodução utiliza o player incorporado oficial do YouTube.

## Observações

- Playlists, favoritos e histórico são salvos apenas no navegador deste dispositivo (`localStorage`), sem sincronização entre aparelhos.
- Vídeos são exibidos pelo player incorporado oficial do YouTube. Anúncios, disponibilidade de incorporação e restrições de segundo plano dependem do YouTube.
- O aplicativo não bloqueia anúncios, não baixa vídeos e não contorna restrições de reprodução.
- O layout usa miniaturas oficiais retornadas pelo YouTube; nenhuma imagem de artistas é armazenada no repositório.
- Para instalar no Android, abra o site via HTTPS e escolha **Instalar aplicativo** no menu do navegador.
