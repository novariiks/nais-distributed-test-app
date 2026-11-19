package cloud.nais.chat

import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.*
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter

@RestController
@RequestMapping("/api")
class ChatController(
    private val messages: MessageService,
    private val live: LiveMessages,
    @param:Value("\${chat.instance}") private val instance: String,
) {
    @GetMapping("/messages")
    fun history(): List<Message> = messages.history()

    @PostMapping("/messages")
    @ResponseStatus(HttpStatus.CREATED)
    fun send(@Valid @RequestBody request: SendMessage): Message = messages.create(request.author, request.body)

    @GetMapping("/events", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    fun events(): SseEmitter = live.subscribe()

    @GetMapping("/info")
    fun info(): Map<String, String> = mapOf("instance" to instance, "application" to "nais-chat")
}

data class SendMessage(
    @field:NotBlank @field:Size(max = 40) val author: String,
    @field:NotBlank @field:Size(max = 2000) val body: String,
)
