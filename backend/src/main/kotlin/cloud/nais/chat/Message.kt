package cloud.nais.chat

import java.time.Instant
import java.util.UUID

data class Message(
    val id: UUID,
    val author: String,
    val body: String,
    val createdAt: Instant,
    val instance: String,
)
