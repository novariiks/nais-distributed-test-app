package cloud.nais.chat

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.support.TransactionTemplate
import java.util.UUID
import java.util.concurrent.TimeUnit

@Component
class OutboxPublisher(
    private val jdbc: JdbcTemplate,
    private val kafka: KafkaTemplate<String, String>,
    private val transaction: TransactionTemplate,
    @param:Value("\${chat.topic}") private val topic: String,
) {
    @Scheduled(fixedDelay = 500)
    fun publish() {
        try {
            transaction.executeWithoutResult {
                val events = jdbc.query(
                    "SELECT id, payload FROM outbox ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED",
                ) { rs, _ -> Event(rs.getObject("id", UUID::class.java), rs.getString("payload")) }
                for (event in events) {
                    try {
                        kafka.send(topic, "lobby", event.payload).get(12, TimeUnit.SECONDS)
                        jdbc.update("DELETE FROM outbox WHERE id = ?", event.id)
                    } catch (e: InterruptedException) {
                        Thread.currentThread().interrupt()
                        throw IllegalStateException("Publishing interrupted", e)
                    } catch (e: Exception) {
                        throw IllegalStateException("Kafka publish failed; outbox retained for retry", e)
                    }
                }
            }
        } catch (e: RuntimeException) {
            logger.warn("Outbox delivery will retry: {}", e.message)
        }
    }

    private data class Event(val id: UUID, val payload: String)

    companion object {
        private val logger = LoggerFactory.getLogger(OutboxPublisher::class.java)
    }
}
