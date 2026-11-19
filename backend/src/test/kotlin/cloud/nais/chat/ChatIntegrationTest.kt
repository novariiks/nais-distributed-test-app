package cloud.nais.chat

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.boot.builder.SpringApplicationBuilder
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext
import org.springframework.jdbc.core.JdbcTemplate
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.utility.DockerImageName
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse.BodyHandlers
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

@Testcontainers
class ChatIntegrationTest {
    @Test
    fun `messages persist and PostgreSQL delivers to browsers on both replicas`() {
        replica("replica-a").use { first ->
            replica("replica-b").use { second ->
                val client = HttpClient.newHttpClient()
                val firstUrl = "http://localhost:${first.webServer.port}"
                val secondUrl = "http://localhost:${second.webServer.port}"
                val streamA = client.send(request("$firstUrl/api/events"), BodyHandlers.ofInputStream()).body()
                val streamB = client.send(request("$secondUrl/api/events"), BodyHandlers.ofInputStream()).body()
                streamA.use { a -> streamB.use { b ->
                    val eventA = CompletableFuture.supplyAsync { a.bufferedReader().lineSequence().first { it.startsWith("data:") && it.contains("Hello PostgreSQL") } }
                    val eventB = CompletableFuture.supplyAsync { b.bufferedReader().lineSequence().first { it.startsWith("data:") && it.contains("Hello PostgreSQL") } }
                    val sent = client.send(
                        HttpRequest.newBuilder(URI.create("$firstUrl/api/messages"))
                            .header("Content-Type", "application/json")
                            .POST(HttpRequest.BodyPublishers.ofString("""{"author":" Ada ","body":"Hello PostgreSQL"}"""))
                            .build(), BodyHandlers.ofString(),
                    )
                    assertThat(sent.statusCode()).isEqualTo(201)
                    assertThat(sent.body()).contains("replica-a", "\"author\":\"Ada\"")
                    assertThat(eventA.get(20, TimeUnit.SECONDS)).contains("Hello PostgreSQL")
                    assertThat(eventB.get(20, TimeUnit.SECONDS)).contains("Hello PostgreSQL")
                } }
                val history = client.send(request("$secondUrl/api/messages"), BodyHandlers.ofString())
                assertThat(history.statusCode()).isEqualTo(200)
                assertThat(history.body()).contains("Hello PostgreSQL", "replica-a")
                for (payload in listOf(
                    """{"author":" ","body":"hello"}""",
                    """{"author":"Ada","body":" "}""",
                    """{"author":"Ada","body":"${"x".repeat(2001)}"}""",
                    """{"body":"missing author"}""",
                )) {
                    val invalid = client.send(
                        HttpRequest.newBuilder(URI.create("$firstUrl/api/messages"))
                            .header("Content-Type", "application/json")
                            .POST(HttpRequest.BodyPublishers.ofString(payload)).build(), BodyHandlers.ofString(),
                    )
                    assertThat(invalid.statusCode()).isEqualTo(400)
                }
                assertThat(first.getBean(JdbcTemplate::class.java).queryForObject("SELECT count(*) FROM messages", Long::class.java)).isEqualTo(1L)
                assertThat(first.getBean(JdbcTemplate::class.java).queryForObject("SELECT to_regclass('public.outbox')::text", String::class.java)).isNull()
            }
        }
        // A fresh application reads the persisted conversation after the original replicas stop.
        replica("replica-c").use { restarted ->
            assertThat(restarted.getBean(MessageService::class.java).history().single().body).isEqualTo("Hello PostgreSQL")
        }
    }

    private fun replica(name: String) = SpringApplicationBuilder(ChatApplication::class.java).run(
        "--server.port=0",
        "--spring.lifecycle.timeout-per-shutdown-phase=2s",
        "--spring.datasource.url=${postgres.jdbcUrl}",
        "--spring.datasource.username=${postgres.username}",
        "--spring.datasource.password=${postgres.password}",
        "--chat.instance=$name",
    ) as ServletWebServerApplicationContext

    private fun request(url: String) = HttpRequest.newBuilder(URI.create(url)).GET().build()

    companion object {
        @Container @JvmField
        val postgres = PostgreSQLContainer<Nothing>(DockerImageName.parse("postgres:17-alpine"))
    }
}
