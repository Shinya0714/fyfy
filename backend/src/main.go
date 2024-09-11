package main

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/csrf"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/gorilla/sessions"
	"github.com/joho/godotenv"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// AWS S3の設定
const (
	S3Endpoint = "http://localstack:4566"
	S3Region   = "ap-northeast-1"
	S3Bucket   = "my-local-bucket"
)

var (
	oauth2Config     *oauth2.Config
	oauthStateString string
	store            *sessions.CookieStore
	storeKeyString   string
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatalf("Error loading .env file")
	}

	oauth2Config = &oauth2.Config{
		ClientID:     os.Getenv("GOOGLE_API_OAUTH2_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_API_OAUTH2_CLIENT_SECRET"),
		RedirectURL:  "https://localhost/api/oauth2callback",
		Scopes:       []string{"profile", "email"},
		Endpoint:     google.Endpoint,
	}
	oauthStateString = generateStateString()

	r := mux.NewRouter()

	// CORS設定
	corsMiddleware := handlers.CORS(
		handlers.AllowedOrigins([]string{"https://localhost"}),
		handlers.AllowedMethods([]string{"GET", "POST", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"X-Csrf-Token", "Content-Type", "Authorization"}),
		handlers.AllowCredentials(),
	)

	// プレフィックスを `/api` としてルーターを作成
	apiRouter := r.PathPrefix("/api").Subrouter()
	apiRouter.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintf(w, "healthy. From reverse proxy.") }).Methods("GET")

	// OAuth2.0
	apiRouter.HandleFunc("/oauth", oauthHandler).Methods("GET")
	apiRouter.HandleFunc("/oauth2callback", callbackHandler).Methods("GET")
	apiRouter.HandleFunc("/oauth2TokenCheck", oauth2TokenCheckHandler).Methods("GET")
	// jwt
	apiRouter.HandleFunc("/jwt", jwtHandler).Methods("GET")
	// CSRF
	apiRouter.HandleFunc("/csrf", csrfHandler).Methods("GET")

	apiRouter.HandleFunc("/upload", uploadHandler).Methods("POST")
	apiRouter.HandleFunc("/download", downloadHandler).Methods("GET")
	apiRouter.HandleFunc("/file/items", getAllItems).Methods("GET")

	// CSRF保護のためのキー
	csrfKey := []byte(generateStateString())

	// CSRF保護ミドルウェアを設定
	csrfMiddleware := csrf.Protect(csrfKey, csrf.Secure(false))

	err = http.ListenAndServeTLS(":8443", "server.crt", "server.key", corsMiddleware(csrfMiddleware(r)))
	if err != nil {
		fmt.Println("Error starting server:", err)
	}
}

// 認証リクエストを処理するハンドラー
func oauthHandler(w http.ResponseWriter, r *http.Request) {
	url := oauth2Config.AuthCodeURL(oauthStateString, oauth2.AccessTypeOffline)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

// コールバック処理のハンドラー
func callbackHandler(w http.ResponseWriter, r *http.Request) {
	if r.FormValue("state") != oauthStateString {
		http.Error(w, "State does not match", http.StatusBadRequest)
		return
	}

	// 認可コードを取得してトークンをリクエスト
	code := r.FormValue("code")
	token, err := oauth2Config.Exchange(context.Background(), code)
	if err != nil {
		http.Error(w, "Failed to exchange token", http.StatusInternalServerError)
		return
	}

	// トークンを使ってユーザー情報を取得
	client := oauth2Config.Client(context.Background(), token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		http.Error(w, "Failed to get user info", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	storeKeyString = os.Getenv("COOKIE_STORE_KEY")
	var store = sessions.NewCookieStore([]byte(storeKeyString))

	session, _ := store.Get(r, "auth-session")
	session.Values["access_token"] = token.AccessToken
	session.Values["refresh_token"] = token.RefreshToken
	session.Save(r, w)

	// ユーザー情報取得が成功した場合にリダイレクト
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func oauth2TokenCheckHandler(w http.ResponseWriter, r *http.Request) {
	storeKeyString = os.Getenv("COOKIE_STORE_KEY")
	var store = sessions.NewCookieStore([]byte(storeKeyString))

	session, _ := store.Get(r, "auth-session")

	accessToken, ok := session.Values["access_token"].(string)
	if !ok {
		http.Error(w, "No token found", http.StatusNotFound)
		return
	}

	response := map[string]string{
		"access_token": accessToken,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func jwtHandler(w http.ResponseWriter, r *http.Request) {
	// JWT生成
	token, err := generateJWT()
	if err != nil {
		fmt.Println("Error generating token:", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"jwt": token})
}

func csrfHandler(w http.ResponseWriter, r *http.Request) {
	token := csrf.Token(r)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"csrf_token": token})
}

// JWT生成
func generateJWT() (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"authorized": true,
		"user":       "user@example.com",
		"exp":        time.Now().Add(time.Minute * 30).Unix(),
	})

	tokenString, err := token.SignedString([]byte(os.Getenv("JWT_SIGNIN_KEY")))
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// JWT検証
func verifyJWT(tokenString string) (*jwt.Token, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(os.Getenv("JWT_SIGNIN_KEY")), nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, fmt.Errorf("token is not valid")
	}

	return token, nil
}

// 鍵の長さを適切な長さにパディングまたはトリミングする関数
func createKey(passPhrase string) []byte {
	key := []byte(passPhrase)
	if len(key) < 16 {
		key = append(key, bytes.Repeat([]byte{0}, 16-len(key))...)
	} else if len(key) > 16 && len(key) < 24 {
		key = append(key, bytes.Repeat([]byte{0}, 24-len(key))...)
	} else if len(key) > 24 && len(key) < 32 {
		key = append(key, bytes.Repeat([]byte{0}, 32-len(key))...)
	} else if len(key) > 32 {
		key = key[:32]
	}
	return key
}

// AES暗号化
func encrypt(data []byte, passPhrase string) ([]byte, error) {
	key := createKey(passPhrase)

	// AESブロック暗号を生成
	block, err := aes.NewCipher(key)
	if err != nil {
		fmt.Println("encrypt block err")
		fmt.Println(err)
		return nil, err
	}

	// Galois/Counter Mode (GCM) を使用するためのインターフェースを生成
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		fmt.Println("encrypt gcm err")
		fmt.Println(err)
		return nil, err
	}

	// GCMのNonce (Number used once) を生成
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		fmt.Println("encrypt readFull err")
		fmt.Println(err)
		return nil, err
	}

	// データを暗号化し、nonceを含む暗号文を生成
	cipherText := gcm.Seal(nonce, nonce, data, nil)

	return cipherText, nil
}

// // AES復号化
// func decrypt(data []byte, passphrase string) ([]byte, error) {
// 	// AESブロック暗号を生成
// 	block, err := aes.NewCipher([]byte(passphrase))
// 	if err != nil {
// 		return nil, err
// 	}

// 	// Galois/Counter Mode (GCM) を使用するためのインターフェースを生成
// 	gcm, err := cipher.NewGCM(block)
// 	if err != nil {
// 		return nil, err
// 	}

// 	// GCMのNonce (Number used once) サイズを取得
// 	nonceSize := gcm.NonceSize()
// 	if len(data) < nonceSize {
// 		return nil, fmt.Errorf("ciphertext too short")
// 	}

// 	// Nonceと暗号文を分割
// 	nonce, ciphertext := data[:nonceSize], data[nonceSize:]

// 	// データを復号化し、プレーンテキストを生成
// 	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
// 	if err != nil {
// 		return nil, err
// 	}

// 	return plaintext, nil
// }

func uploadHandler(w http.ResponseWriter, r *http.Request) {
	// Authorizationヘッダーからトークンを取得
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "No Authorization header", http.StatusUnauthorized)
		return
	}

	// "Bearer " のプレフィックスを取り除いてJWTトークンを取得
	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	if tokenString == authHeader {
		http.Error(w, "Invalid Authorization header format", http.StatusUnauthorized)
		return
	}

	// JWT検証
	token, err := verifyJWT(tokenString)
	if err != nil {
		fmt.Println("Error verifying token:", err)
		return
	}
	fmt.Println("Token is valid:", token)

	// LocalStackのS3クライアントを作成
	sess := session.Must(session.NewSession(&aws.Config{
		Endpoint:         aws.String(S3Endpoint),
		Region:           aws.String(S3Region),
		Credentials:      credentials.NewStaticCredentials("dummy", "dummy", ""),
		S3ForcePathStyle: aws.Bool(true),
	}))
	svc := s3.New(sess)

	// バケットの存在確認
	_, err = svc.HeadBucket(&s3.HeadBucketInput{
		Bucket: aws.String(S3Bucket),
	})
	if err != nil {
		// バケットの作成
		bucketName := S3Bucket
		_, err = svc.CreateBucket(&s3.CreateBucketInput{
			Bucket: aws.String(bucketName),
		})
		if err != nil {
			log.Fatalf("Failed to create bucket: %v", err)
		}

		// バケットが正常に作成されたことを確認
		fmt.Printf("Successfully created bucket %s\n", bucketName)
	} else {
		fmt.Printf("Bucket %s exists\n", S3Bucket)
	}

	// todo:エラーチェック
	// r.ParseMultipartForm(10 << 20) // 最大10MBまでのファイルを処理できるように設定

	file, handler, err := r.FormFile("pdfFile")
	if err != nil {
		fmt.Println("Error retrieving the file")
		fmt.Println(err)
		return
	}
	defer file.Close()

	// ファイル内容をバイトスライスに読み取る
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		fmt.Println("Error reading the file")
		fmt.Println(err)
		return
	}

	fmt.Printf("Uploaded File: %+v\n", handler.Filename)
	fmt.Printf("File Size: %+v\n", handler.Size)
	fmt.Printf("MIME Header: %+v\n", handler.Header)
	// fmt.Printf("File Bytes: %v\n", fileBytes)

	// AES暗号化
	encryptedData, err := encrypt(fileBytes, "thisis16byteskey")
	if err != nil {
		fmt.Println("Failed to encrypt data:", err)
		return
	}

	// S3にファイルをアップロード
	_, err = svc.PutObject(&s3.PutObjectInput{
		Bucket: aws.String(S3Bucket),
		// S3にアップロードする際のオブジェクトキー
		Key:  aws.String(handler.Filename),
		Body: bytes.NewReader(encryptedData),
	})
	if err != nil {
		fmt.Println("Error uploading to S3:", err)
		http.Error(w, "Failed to upload file to S3", http.StatusInternalServerError)
		return
	}

	// DynamoDBクライアントの作成
	dynamodbClient := dynamodb.New(sess)

	// テーブルの存在確認
	_, err = dynamodbClient.DescribeTable(&dynamodb.DescribeTableInput{
		TableName: aws.String("TestTable"),
	})
	if err == nil {
		fmt.Println("Table TestTable exists")
	} else {
		// テーブル作成のリクエストを定義
		createTableInput := &dynamodb.CreateTableInput{
			TableName: aws.String("TestTable"),
			KeySchema: []*dynamodb.KeySchemaElement{
				{
					AttributeName: aws.String("ID"),
					KeyType:       aws.String(dynamodb.KeyTypeHash),
				},
			},
			AttributeDefinitions: []*dynamodb.AttributeDefinition{
				{
					AttributeName: aws.String("ID"),
					AttributeType: aws.String(dynamodb.ScalarAttributeTypeS),
				},
			},
			ProvisionedThroughput: &dynamodb.ProvisionedThroughput{
				ReadCapacityUnits:  aws.Int64(5),
				WriteCapacityUnits: aws.Int64(5),
			},
		}

		// テーブルの作成
		_, err = dynamodbClient.CreateTable(createTableInput)
		if err != nil {
			log.Fatalf("failed to create table, %v", err)
		}

		fmt.Println("Table successfully created!")
	}

	uuid, err := GenerateUUIDv4()
	if err != nil {
		fmt.Println("Error generating UUID:", err)
		return
	}

	password, err := GenerateRandomPassword(16)
	if err != nil {
		fmt.Println("Error generating password:", err)
		return
	}

	// 挿入するアイテムを定義
	item := map[string]*dynamodb.AttributeValue{
		"ID": {
			S: aws.String(uuid),
		},
		"Name": {
			S: aws.String(handler.Filename),
		},
		"Password": {
			S: aws.String(password),
		},
	}

	// アイテムをDynamoDBに挿入
	_, err = dynamodbClient.PutItem(&dynamodb.PutItemInput{
		TableName: aws.String("TestTable"),
		Item:      item,
	})
	if err != nil {
		log.Fatalf("failed to put item, %v", err)
	}

	fmt.Println("Item successfully inserted!")

	// JSONに変換
	itemJSON, err := json.Marshal(item)
	if err != nil {
		http.Error(w, "Failed to marshal item to JSON", http.StatusInternalServerError)
		return
	}

	// HTTPレスポンスのヘッダーを設定
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	// JSONデータをレスポンスとして書き込む
	w.Write(itemJSON)
}

func downloadHandler(w http.ResponseWriter, r *http.Request) {
	// クエリパラメータを取得
	queryParams := r.URL.Query()

	// 特定のパラメータを取得
	id := queryParams.Get("id")

	// コンソールに出力
	fmt.Println("ID:", id)

	// LocalStackのS3クライアントを作成
	sess := session.Must(session.NewSession(&aws.Config{
		Endpoint:         aws.String(S3Endpoint),
		Region:           aws.String(S3Region),
		Credentials:      credentials.NewStaticCredentials("dummy", "dummy", ""),
		S3ForcePathStyle: aws.Bool(true),
	}))
	svc := s3.New(sess)

	// PDFファイルの取得
	key := "test.pdf"
	resp, err := svc.GetObject(&s3.GetObjectInput{
		Bucket: aws.String(S3Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		http.Error(w, "Failed to get object from S3", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	// コンテンツタイプをPDFに設定
	w.Header().Set("Content-Type", "application/pdf")

	// PDFファイルをレスポンスとして書き込む
	if _, err := io.Copy(w, resp.Body); err != nil {
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
	}
}

// func makeBucket() error {
// 	return nil , error
// }

// UUID生成
func GenerateUUIDv4() (string, error) {
	uuid := make([]byte, 16)
	_, err := io.ReadFull(rand.Reader, uuid)
	if err != nil {
		return "", err
	}

	uuid[6] = (uuid[6] & 0x0f) | 0x40 // Version 4
	uuid[8] = (uuid[8] & 0x3f) | 0x80 // Variant 10

	return fmt.Sprintf("%s-%s-%s-%s-%s",
		hex.EncodeToString(uuid[0:4]),
		hex.EncodeToString(uuid[4:6]),
		hex.EncodeToString(uuid[6:8]),
		hex.EncodeToString(uuid[8:10]),
		hex.EncodeToString(uuid[10:]),
	), nil
}

func getAllItems(w http.ResponseWriter, r *http.Request) {
	// DynamoDBセッションの作成
	sess, err := session.NewSession(&aws.Config{
		Endpoint:    aws.String(S3Endpoint),
		Region:      aws.String(S3Region),
		Credentials: credentials.NewStaticCredentials("dummy", "dummy", ""),
	})
	if err != nil {
		http.Error(w, "Failed to create DynamoDB session", http.StatusInternalServerError)
		return
	}

	// DynamoDBクライアントの作成
	svc := dynamodb.New(sess)

	// Scanのリクエストを作成
	result, err := svc.Scan(&dynamodb.ScanInput{
		TableName: aws.String("TestTable"),
	})
	if err != nil {
		http.Error(w, "Failed to scan DynamoDB table", http.StatusInternalServerError)
		return
	}

	// アイテムをJSON形式でエンコード
	response, err := json.Marshal(result.Items)
	if err != nil {
		http.Error(w, "Failed to encode response as JSON", http.StatusInternalServerError)
		return
	}

	// HTTPレスポンスのヘッダーを設定
	w.Header().Set("Content-Type", "application/json")
	w.Write(response)
}

func GenerateRandomPassword(length int) (string, error) {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}|;:,.<>?/~`"

	// charsetからランダムな文字を生成するためのスライスを作成
	bytes := make([]byte, length)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", err
	}

	// bytesからランダムに文字を選択
	for i := 0; i < length; i++ {
		bytes[i] = charset[int(bytes[i])%len(charset)]
	}

	return string(bytes), nil
}

func generateStateString() string {
	// ランダムな32バイトのデータを生成し、base64エンコード
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		// エラー処理
		return ""
	}
	return base64.URLEncoding.EncodeToString(b)
}
