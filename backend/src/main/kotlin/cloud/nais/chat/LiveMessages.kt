package cloud.nais.chat

import tools.jackson.databind.ObjectMapper
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.io.IOException
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

@Component
class LiveMessages(
    private val messages: MessageService,
    private val json: ObjectMapper,
) {
    private val clients = ConcurrentHashMap.newKeySet<SseEmitter>()
    private var seen = emptySet<UUID>()

    fun subscribe(): SseEmitter {
        val emitter = SseEmitter(0L)
        clients.add(emitter)
        emitter.onCompletion { clients.remove(emitter) }
        emitter.onTimeout { clients.remove(emitter) }
        emitter.onError { clients.remove(emitter) }
        try {
            emitter.send(SseEmitter.event().name("connected").data("ready"))
        } catch (e: Exception) {
            clients.remove(emitter)
            throw e
        }
        return emitter
    }

    // Each replica reads committed history independently to notify its own clients.
    // Re-reading the bounded window also catches transactions that commit out of order.
    @Scheduled(fixedDelay = 500)
    fun poll() {
        val recent = messages.history()
        for (message in recent) {
            if (message.id !in seen) broadcast("message", json.writeValueAsString(message))
        }
        seen = recent.mapTo(mutableSetOf()) { it.id }
    }

    @Scheduled(fixedRate = 15000)
    fun heartbeat() = broadcast("heartbeat", "ping")

    private fun broadcast(name: String, payload: String) {
        for (client in clients) {
            try {
                client.send(SseEmitter.event().name(name).data(payload))
            } catch (_: IOException) {
                clients.remove(client)
                client.complete()
            } catch (_: IllegalStateException) {
                clients.remove(client)
            }
        }
    }
}
