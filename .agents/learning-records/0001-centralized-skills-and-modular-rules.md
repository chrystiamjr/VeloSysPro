# Centralized Skills & Modular Rules Architecture

Established `~/.agents/skills/` as the single source of truth for all AI agent skills, linked via real-time NTFS Junctions to Claude Code, Gemini, and Codex. Refactored workspace rules into `.agents/rules/` and replaced inline text blocks in `AGENTS.md` with a clean 3-column reference table.

## Details & Context
- **Skills Directory**: `C:\Users\chrys\.agents\skills\`
- **Project Rules Directory**: `<workspace-root>/.agents/rules/`
- **Index Format**: `| Regra / Título | Caminho (Documento Completo) | Keywords / Resumo |`
- **Real-Time Junctions**: Editing central skills updates all local IAs instantly without needing manual sync commands.
