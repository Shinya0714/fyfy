package main

import (
	"log"
	"net/http"
)

func main() {
	// // OAuth2サーバーの初期化
	// srv := server.NewServer(server.NewConfig(), store.NewMemoryStore())

	// // OAuth2のエンドポイントのハンドラー設定
	// srv.HandleAuthorizeRequest = func(w http.ResponseWriter, r *http.Request) {
	// 	srv.HandleAuthorizeRequest(w, r)
	// }

	// srv.HandleTokenRequest = func(w http.ResponseWriter, r *http.Request) {
	// 	srv.HandleTokenRequest(w, r)
	// }

	// サーバーの起動
	log.Println("OAuth2 server listening on port 8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

// package main

// import (
//     "fmt"
//     "log"
//     "golang.org/x/oauth2"
// )

// func main() {
//     // OAuth 2.0の設定
//     config := &oauth2.Config{
//         ClientID:     "your-client-id",
//         ClientSecret: "your-client-secret",
//         Endpoint: oauth2.Endpoint{
//             AuthURL:  "http://localhost:8080/auth",
//             TokenURL: "http://localhost:8080/token",
//         },
//         RedirectURL: "http://localhost:8080/callback",
//     }

//     // 認証URLの生成
//     authURL := config.AuthCodeURL("state", oauth2.AccessTypeOffline)
//     fmt.Println("Visit the following URL for authentication:", authURL)

//     // 認証コードの取得
//     var authCode string
//     fmt.Print("Enter the authorization code: ")
//     fmt.Scan(&authCode)

//     // トークンの取得
//     token, err := config.Exchange(oauth2.NoContext, authCode)
//     if err != nil {
//         log.Fatal(err)
//     }

//     fmt.Println("Access Token:", token.AccessToken)
// }
