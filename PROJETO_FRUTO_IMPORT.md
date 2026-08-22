# Fruto Import — Teste Supabase 1.0

Ambiente paralelo de validação. O site principal não é alterado.

- Base visual: V16.2
- Produtos: 302 produtos copiados no Supabase
- Catálogo: somente leitura via RPC `get_public_catalog`
- Imagens: URLs do site principal
- PDF: consulta a cópia do Supabase
- Admin: propositalmente desativado


## Teste Supabase 1.2 Storage
- Migrador de imagens resiliente por lote.
- URLs antigas com falha não interrompem a migração.
- Falhas ficam marcadas para revisão posterior.
- Site principal permanece intocado.
