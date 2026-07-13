# 📘 Documentação da API de Telemetria (Confidencial)

Este documento contém as especificações técnicas, autenticação, modelos de payloads e exemplos práticos para integração com a API de Telemetria do Placar de Corrida.

> [!CAUTION]
> **INFORMAÇÃO CONFIDENCIAL**: Este documento contém credenciais de acesso locais e detalhes estruturais de segurança. Não deve ser compartilhado publicamente ou versionado em repositórios abertos sem ocultar as chaves de acesso.

---

## 🔒 Autenticação

Todas as requisições de escrita (ingestão de telemetria) exigem autenticação via chave secreta. O backend valida a assinatura da chave usando algoritmos de comparação de tempo constante para proteção contra *Timing Attacks*.

* **Header obrigatório**: `x-api-key`
* **Credenciais de Desenvolvimento (Local)**: `t&7XqM2@pB$9vY!`
* **Credenciais de Produção (Render)**: Configurada no painel do Render via variável de ambiente `API_KEY`.

---

## 🚦 Endpoints da API

| Método | Rota | Descrição | Requer Auth? |
| :--- | :--- | :--- | :---: |
| **GET** | `/` | Confirmação de status e rotas | Não |
| **GET** | `/health` | Checagem de saúde e timestamp do servidor | Não |
| **POST** | `/api/telemetria` | Ingestão e transmissão de dados de corrida | **Sim** (`x-api-key`) |

---

## 📝 Ingestão de Dados (`POST /api/telemetria`)

Este endpoint recebe um JSON contendo uma lista de pilotos e suas respectivas colocações/tempos, e faz o broadcast imediato via WebSockets (Socket.io) para os clientes conectados.

### Regras de Validação do Schema (Zod)

O payload enviado deve ser um **Array JSON** contendo no máximo **100 objetos**. Cada objeto (piloto) deve seguir rigorosamente os critérios:

| Campo | Tipo Esperado | Validação / Restrição | Descrição |
| :--- | :--- | :--- | :--- |
| `colocacao` | Número (Inteiro) | Mínimo `1` | Posição atual do piloto na corrida. |
| `numero` | String ou Número | Máx. `10` caracteres. Regex: `^[a-zA-Z0-9#\s-]+$` | Número da moto/carro. É convertido automaticamente para texto. |
| `nome` | String | Mín. `1`, Máx. `50` caracteres. | Nome completo ou abreviado do piloto. |
| `voltas` | Número (Inteiro) | Mínimo `0` | Quantidade de voltas completadas. |
| `tempo` | String | Regex: `^([0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}\|-)$` | Tempo da volta (ex: `00:05:15.200`) ou `-` caso sem tempo. |
| `categoria` | String | Mín. `1`, Máx. `30` caracteres. | Categoria do piloto (ex: `MX1`, `MX2`, `MX3`). |

* **Campos Extra (Passthrough)**: Campos adicionais enviados no payload (como `"bateria": "1ª Bateria"`) são aceitos pelo validador, preservados e repassados na transmissão do socket para o frontend.

---

## 💻 Exemplos de Envio (POST)

### 1. PowerShell (Windows)
> [!IMPORTANT]
> No PowerShell, sempre utilize **aspas simples** (`'`) para definir a chave `x-api-key`, evitando que o caractere especial `$` seja interpretado como uma variável local do console.

```powershell
$body = @(
  @{
    colocacao = 1
    numero = 3
    nome = "Bernardo Tiburcio"
    voltas = 3
    tempo = "00:05:15.200"
    categoria = "MX2"
    bateria = "1ª Bateria"
  },
  @{
    colocacao = 2
    numero = 44
    nome = "Marcello Leodorico"
    voltas = 3
    tempo = "00:05:16.800"
    categoria = "MX2"
    bateria = "1ª Bateria"
  }
) | ConvertTo-Json

# Teste Local
Invoke-RestMethod -Uri "http://localhost:3001/api/telemetria" -Method Post -Headers @{"x-api-key"='t&7XqM2@pB$9vY!'} -Body $body -ContentType "application/json; charset=utf-8"

# Teste em Produção (Render)
# Invoke-RestMethod -Uri "https://placar-backend.onrender.com/api/telemetria" -Method Post -Headers @{"x-api-key"='SUA_CHAVE_DE_PRODUCAO'} -Body $body -ContentType "application/json; charset=utf-8"
```

### 2. cURL (Git Bash / Linux / macOS)
```bash
# Executando contra a API em produção no Render
curl -X POST "https://placar-backend.onrender.com/api/telemetria" \
  -H "Content-Type: application/json" \
  -H "x-api-key: SUA_CHAVE_DE_PRODUCAO" \
  -d '[
    {
      "colocacao": 1,
      "numero": 3,
      "nome": "Bernardo Tiburcio",
      "voltas": 3,
      "tempo": "00:05:15.200",
      "categoria": "MX2",
      "bateria": "1ª Bateria"
    },
    {
      "colocacao": 2,
      "numero": 44,
      "nome": "Marcello Leodorico",
      "voltas": 3,
      "tempo": "00:05:16.800",
      "categoria": "MX2",
      "bateria": "1ª Bateria"
    }
  ]'
```

### 3. Exemplo em C# (Integração com Software de Cronometragem)
Caso o transmissor da pista seja desenvolvido em C# (.NET):

```csharp
using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

class Program
{
    private static readonly HttpClient client = new HttpClient();

    static async Task Main()
    {
        string url = "https://placar-backend.onrender.com/api/telemetria";
        string apiKey = "SUA_CHAVE_DE_PRODUCAO";

        string jsonPayload = @"[
            {
                ""colocacao"": 1,
                ""numero"": 3,
                ""nome"": ""Bernardo Tiburcio"",
                ""voltas"": 3,
                ""tempo"": ""00:05:15.200"",
                ""categoria"": ""MX2"",
                ""bateria"": ""1ª Bateria""
            }
        ]";

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Add("x-api-key", apiKey);
            request.Content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

            HttpResponseMessage response = await client.SendAsync(request);
            string responseBody = await response.Content.ReadAsStringAsync();

            Console.WriteLine($"Status: {response.StatusCode}");
            Console.WriteLine($"Resposta: {responseBody}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Erro: {ex.Message}");
        }
    }
}
```

---

## ⚡ Conexão WebSocket (Sincronização em Tempo Real)

O painel frontend consome os dados em tempo real conectando-se ao servidor Socket.io.

* **Evento de Escuta**: `atualizacao_telemetria`
* **Mecanismo de Sincronização Imediata (Cache)**:
  Toda vez que um novo celular ou navegador se conecta no WebSocket, o servidor verifica se já recebeu alguma telemetria prévia do dia. Caso exista, o backend envia os últimos dados imediatamente por esse canal privado para o aparelho que acabou de conectar, eliminando telas em branco.
