# Backup e Auditoria do Sistema - 02/01/2026

## 📋 Checklist de Backup

### 1. Backup do Banco de Dados (Supabase Dashboard)
- [ ] Acessar Supabase Dashboard
- [ ] Ir em "Database" → "Backups"
- [ ] Clicar em "Create Backup" (backup manual)
- [ ] Anotar: Data/Hora do backup: ________________
- [ ] Confirmar backup criado com sucesso

**Instruções:**
1. Acesse: https://supabase.com/dashboard/project/ftmhqrohrycbiverwila/database/backups
2. Clique no botão "Create backup"
3. Aguarde confirmação (pode levar 1-2 minutos)
4. Anote o timestamp do backup para referência futura

### 2. Backup de Políticas RLS (SQL)
- [x] Executar query de auditoria de políticas
- [ ] Salvar output em `backup_rls_policies.sql`
- [ ] Verificar que todas as tabelas estão incluídas

**Arquivo gerado:** `backup_rls_policies_20260102.sql`

### 3. Backup de Arquivos Locais
- [ ] Fazer commit do código atual no Git
- [ ] Criar branch de backup: `backup-before-teacher-access-control`
- [ ] Push para repositório remoto

**Comandos:**
```bash
cd c:/apps/escolav2
git add .
git commit -m "Backup antes da implementação de controle de acesso para professores"
git checkout -b backup-before-teacher-access-control
git push origin backup-before-teacher-access-control
```

### 4. Documentar Estado Atual
- [x] Listar todas as tabelas com RLS habilitado
- [x] Documentar políticas por tabela
- [ ] Anotar comportamento esperado por role

## 📊 Estado Atual do Sistema

### Tabelas com RLS Habilitado (Total: 15)

1. **app_settings** - Configurações do app
2. **class_attendance_sheets** - Folhas de presença
3. **class_enrollments** - Matrículas em turmas
4. **class_teachers** - Professor ↔ Turma (JÁ EXISTE!)
5. **classes** - Turmas
6. **diary_entries** - Entradas de diário
7. **enrollments** - Matrículas/Candidatos
8. **events** - Eventos/Calendário
9. **expenses** - Despesas
10. **financial_plans** - Planos financeiros
11. **installments** - Parcelas
12. **notifications** - Notificações
13. **profiles** - Perfis de usuário
14. **student_guardians** - Aluno ↔ Responsável
15. **students** - Alunos
16. **tasks** - Tarefas (sem autenticação específica)

### ⚠️ IMPORTANTE: Tabela class_teachers JÁ EXISTE!

A tabela `class_teachers` **já foi criada anteriormente**. Isso significa:
- ✅ Não precisamos criar do zero
- ✅ Já tem RLS habilitado
- ⚠️ Precisamos verificar se a estrutura está correta
- ⚠️ Verificar se já existem dados (vínculos professor-turma)

**Políticas existentes em class_teachers:**
- "Admins full access class_teachers" - ADMIN pode tudo

### Políticas Críticas por Tabela

#### classes (Turmas)
- ✅ "Admins full access classes" - ADMIN pode tudo
- ✅ "Guardians view assigned classes" - Responsáveis veem turmas dos filhos
- ⚠️ **FALTANDO**: Política para TEACHER ver turmas atribuídas

#### students (Alunos)
- ✅ "Admins can do everything on students" - ADMIN pode tudo
- ✅ "Guardians view linked students" - Responsáveis veem filhos
- ⚠️ **FALTANDO**: Política para TEACHER ver alunos de suas turmas

#### class_attendance_sheets (Presença)
- ✅ "Staff manage attendance_sheets" - ADMIN/SECRETARY/TEACHER podem gerenciar
- ✅ "Guardians view attendance_sheets" - Responsáveis visualizam
- ⚠️ **PROBLEMA POTENCIAL**: TEACHER pode ver TODOS os attendance sheets (sem filtro por turma)

#### diary_entries (Diário)
- ✅ "Staff manage diary" - ADMIN/SECRETARY/TEACHER podem gerenciar
- ✅ "Guardians view diary" - Responsáveis visualizam
- ⚠️ **PROBLEMA POTENCIAL**: TEACHER pode ver TODOS os diários (sem filtro por turma)

## 🔍 Descobertas da Auditoria

### Boas Notícias ✅
1. A maioria das políticas **já usa** `is_admin()` corretamente
2. Tabela `class_teachers` já existe (estrutura pronta)
3. PARENT (responsáveis) já tem políticas bem definidas
4. Sistema de RLS já está maduro e funcional

### Atenção Necessária ⚠️
1. **class_attendance_sheets**: TEACHER pode ver/editar TUDO atualmente
2. **diary_entries**: TEACHER pode ver/editar TUDO atualmente  
3. **classes**: TEACHER atualmente não vê nada (ou vê tudo se usar query direta)
4. **students**: TEACHER atualmente não vê nada (ou vê tudo se usar query direta)

### Ajustes Necessários
Em vez de criar políticas do zero, vamos **MODIFICAR** as existentes:

1. `class_attendance_sheets` → Adicionar filtro `teacher_has_class_access(class_id)`
2. `diary_entries` → Adicionar filtro `teacher_has_class_access(class_id)`
3. `classes` → Adicionar cláusula para TEACHER ver turmas atribuídas
4. `students` → Adicionar cláusula para TEACHER ver alunos via turmas

## 📝 Próximos Passos

Após confirmar backup:
1. ✅ Verificar estrutura de `class_teachers` (já existe)
2. ✅ Criar funções helper se não existirem
3. ⚠️ MODIFICAR (não criar) políticas existentes
4. 🧪 Testar com ADMIN primeiro
5. 🧪 Testar com TEACHER
6. 🧪 Testar com PARENT (não-regressão)

## 🔄 Plano de Rollback

Se algo der errado, temos 3 níveis de recuperação:

**Nível 1: Rollback de Políticas (Rápido - 2min)**
```sql
-- Restaurar políticas de backup_rls_policies_20260102.sql
\i backup_rls_policies_20260102.sql
```

**Nível 2: Restaurar Backup do Banco (Médio - 10min)**
- Supabase Dashboard → Database → Backups
- Selecionar backup de hoje
- Clicar "Restore"

**Nível 3: Reverter Código (Rápido - 1min)**
```bash
git checkout backup-before-teacher-access-control
```

## ✅ Confirmação de Prontidão

Antes de prosseguir para Fase 2, confirmar:
- [ ] Backup manual criado no Supabase
- [ ] Código commitado e push feito
- [ ] Arquivo `backup_rls_policies_20260102.sql` salvo localmente
- [ ] Auditoria revisada e compreendida
- [ ] Plano de rollback testado mentalmente

**Depois de confirmar todos os itens, podemos prosseguir para Fase 2!**
