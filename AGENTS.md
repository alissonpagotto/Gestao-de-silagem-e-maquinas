# Instruções Persistentes do Projeto (AGENTS.md)

## Regras Obrigatórias de Formatação de Moeda e Números (Padrão PT-BR)
1. **Formatação de Moeda Comercial Brasileira (R$)**:
   - Sempre que gerar fórmulas, códigos, campos, exibições ou exemplos de valores em Real Brasileiro, utilizar estritamente o formato `R$ #.##0,00` (com ponto `.` como separador de milhar e vírgula `,` como separador decimal, com duas casas decimais).
   - Exemplos: `R$ 1.250,00`, `R$ 14.890,50`, `R$ 0,75`.

2. **Contexto e Funções do AppSheet**:
   - Quando envolver fórmulas de texto, exibição ou formatação no AppSheet (como a função `TEXT()`), utilizar a máscara e concatenação correspondente ao padrão comercial brasileiro:
     `CONCATENATE("R$ ", TEXT([Coluna_Valor], "#,##0.00"))` ou máscara monetária com prefixo `"R$ "` e formato decimal brasileiro conforme a localização da planilha/AppSheet.

3. **Preservação de Design e Estilo**:
   - Nunca alterar cores, fontes, temas, espaçamentos ou layout visual da aplicação sem solicitação explícita do usuário.
