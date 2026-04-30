import Foundation

/// Stream a URL request via SSE and yield data payloads
struct SSESession {
    static func stream(urlRequest: URLRequest) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            let delegate = SSEDelegate(continuation: continuation)
            let session = URLSession(
                configuration: .default,
                delegate: delegate,
                delegateQueue: nil
            )
            let dataTask = session.dataTask(with: urlRequest)
            dataTask.resume()

            continuation.onTermination = { _ in
                dataTask.cancel()
                session.invalidateAndCancel()
            }
        }
    }
}

private final class SSEDelegate: NSObject, URLSessionDataDelegate {
    let continuation: AsyncThrowingStream<String, Error>.Continuation
    private var buffer = ""

    init(continuation: AsyncThrowingStream<String, Error>.Continuation) {
        self.continuation = continuation
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse) async -> URLSession.ResponseDisposition {
        .allow
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        guard let chunk = String(data: data, encoding: .utf8) else { return }
        buffer.append(chunk)

        while let range = buffer.range(of: "\n\n") {
            let block = String(buffer[buffer.startIndex..<range.lowerBound])
            buffer = String(buffer[range.upperBound...])

            for line in block.components(separatedBy: "\n") {
                let normalized = line.replacingOccurrences(of: "\r", with: "")
                if normalized.hasPrefix("data:") {
                    let payload = String(normalized.dropFirst(5)).trimmingCharacters(in: .whitespaces)
                    if payload == "[DONE]" {
                        continuation.finish()
                        return
                    }
                    continuation.yield(payload)
                }
            }
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error {
            continuation.finish(throwing: error)
        } else {
            continuation.finish()
        }
    }
}
