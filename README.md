# Facial Time Clock (Node.js + PostgreSQL)

Fluxo local:
- Cadastro: nome + idade + foto.
- Ponto: apenas foto; identifica pessoa cadastrada, mostra nome/idade e grava em `registroPonto`.

## Dependencias
- `express`
- `pg`
- `dotenv`
- `cors`
- `face-api.js` (frontend)

## Tabelas
O sistema usa:
- Sua tabela existente: `public."registroPonto"`
- Nova tabela para biometria: `public.face_users`

SQL da tabela nova em: `sql/init.sql`.

## Config local
1. Instale dependencias:
   ```bash
   npm install
   ```
2. Crie `.env` com base no `.env.example`.
3. Execute `sql/init.sql` no seu PostgreSQL local.
4. Rode:
   ```bash
   npm run dev
   ```
5. Abra:
   - `http://localhost:3000`

## Uso
1. Clique `Iniciar Camera`.
2. Em `Cadastrar pessoa`, preencha nome e idade, depois `Cadastrar com Foto`.
3. Em `Bater ponto`, clique `Bater Ponto com Foto`.
4. Se reconhecer, mostrara nome/idade e salva no banco.
