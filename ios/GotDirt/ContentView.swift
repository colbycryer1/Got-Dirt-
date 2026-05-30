import SwiftUI
import WebKit

struct WebView: UIViewRepresentable {
    let url: URL
    @Binding var isLoading: Bool

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = prefs

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .always

        let refresh = UIRefreshControl()
        refresh.addTarget(context.coordinator,
                          action: #selector(Coordinator.handleRefresh(_:)),
                          for: .valueChanged)
        webView.scrollView.refreshControl = refresh
        context.coordinator.refreshControl = refresh
        context.coordinator.webView = webView

        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    // MARK: - Coordinator

    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        let parent: WebView
        weak var webView: WKWebView?
        var refreshControl: UIRefreshControl?

        init(_ parent: WebView) { self.parent = parent }

        @objc func handleRefresh(_ sender: UIRefreshControl) {
            webView?.reload()
        }

        // MARK: WKNavigationDelegate

        func webView(_ webView: WKWebView, didStartProvisionalNavigation _: WKNavigation!) {
            parent.isLoading = true
        }

        func webView(_ webView: WKWebView, didFinish _: WKNavigation!) {
            parent.isLoading = false
            refreshControl?.endRefreshing()
        }

        func webView(_ webView: WKWebView, didFail _: WKNavigation!, withError _: Error) {
            parent.isLoading = false
            refreshControl?.endRefreshing()
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation _: WKNavigation!, withError _: Error) {
            parent.isLoading = false
            refreshControl?.endRefreshing()
        }

        // MARK: WKUIDelegate — camera/microphone for Stripe card scan

        func webView(_ webView: WKWebView,
                     requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                     initiatedByFrame frame: WKFrameInfo,
                     type: WKMediaCaptureType,
                     decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(.grant)
        }
    }
}

struct ContentView: View {
    @State private var isLoading = true
    private let appURL = URL(string: "https://www.gotdirt.us")!

    var body: some View {
        ZStack {
            WebView(url: appURL, isLoading: $isLoading)
                .ignoresSafeArea()

            if isLoading {
                VStack {
                    Spacer()
                    ProgressView("Loading Got Dirt?...")
                        .progressViewStyle(CircularProgressViewStyle(tint: .orange))
                        .padding(20)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
                    Spacer()
                }
            }
        }
    }
}

#Preview {
    ContentView()
}
