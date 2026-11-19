package cloud.nais.chat

import org.springframework.kafka.annotation.KafkaListener
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap

@Component
class LiveMessages {
    private val clients = ConcurrentHashMap.newKeySet<SseEmitter>()

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

    @KafkaListener(topics = ["\${chat.topic}"])
    fun receive(payload: String) = broadcast("message", payload)

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
