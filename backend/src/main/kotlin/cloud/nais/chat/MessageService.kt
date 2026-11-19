package cloud.nais.chat

import org.springframework.beans.factory.annotation.Value
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.sql.Timestamp
import java.time.Instant
import java.util.UUID

@Service
class MessageService(
    private val jdbc: JdbcTemplate,
    @param:Value("\${chat.instance}") private val instance: String,
) {
    @Transactional
    fun create(author: String, body: String): Message {
        val message = Message(UUID.randomUUID(), author.trim(), body.trim(), Instant.now(), instance)
        jdbc.update(
            "INSERT INTO messages (id, author, body, created_at, instance) VALUES (?, ?, ?, ?, ?)",
            message.id, message.author, message.body, Timestamp.from(message.createdAt), instance,
        )
        return message
    }

    fun history(): List<Message> = jdbc.query(
        """
        SELECT * FROM (SELECT * FROM messages ORDER BY created_at DESC, id DESC LIMIT 100) recent
        ORDER BY created_at, id
        """.trimIndent(),
    ) { rs, _ ->
        Message(
            rs.getObject("id", UUID::class.java), rs.getString("author"), rs.getString("body"),
            rs.getTimestamp("created_at").toInstant(), rs.getString("instance"),
        )
    }
}
