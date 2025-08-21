package main

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"text/template"
)

type Lesson struct {
	Title          string `json:"title"`
	Content        string `json:"content"`
	StartingCode   string `json:"starting_code"`
	ExpectedResult string `json:"expected_result"`
	Completed      bool   `json:"completed"`
}

type Unit struct {
	Name        string   `json:"unit_name"`
	Description string   `json:"unit_description"`
	Lessons     []Lesson `json:"lessons"`
}

func DecodeData(text []byte) ([]byte, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(string(text))
	if err != nil {
		return nil, err
	}

	key := []byte("qd!H%~0R3uvuKE2j96z2Q!d/ET<J#2Ya")
	if len(key) != 32 {
		return nil, errors.New("key must be 32 bytes for AES-256")
	}

	iv := []byte("8p0=oO@KQ4aS")
	if len(iv) != 12 {
		return nil, errors.New("IV must be 12 bytes for AES-GCM")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	plaintext, err := aesgcm.Open(nil, iv, ciphertext, nil)
	if err != nil {
		return nil, err
	}

	return plaintext, nil
}

func GetUnitJson(unitid uint8) (Unit, error) {
	path := fmt.Sprintf("./public/units/unit-%d.json", unitid)
	jsondata, err := os.ReadFile(path)
	if err != nil {
		return Unit{}, errors.New(err.Error())
	}

	decodedJson, err := DecodeData(jsondata)
	if err != nil {
		return Unit{}, errors.New(err.Error())
	}

	var unit Unit
	json.Unmarshal(decodedJson, &unit)

	return unit, nil
}

func HomeHandler(w http.ResponseWriter, r *http.Request) {
	var units []Unit
	var i uint8 = 0

	currUnit, err := GetUnitJson(i)

	for err == nil {
		units = append(units, currUnit)

		i += 1
		currUnit, err = GetUnitJson(i)
	}
	index := template.Must(template.New("index").Funcs(template.FuncMap{
		"add": func(a, b int) int { return a + b },
	}).ParseFiles("./public/views/index.html"))

	index.ExecuteTemplate(w, "index.html", struct {
		Units []Unit
	}{
		Units: units,
	})
}

func StaticHandler(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	parts := strings.Split(path, "/")
	fileType := parts[2]
	reqFile := parts[3]

	switch fileType {
	case "css":
		filePath := fmt.Sprintf("./public/css/%s", reqFile)
		http.ServeFile(w, r, filePath)
	}
}

func main() {
	http.HandleFunc("/static/", StaticHandler)
	http.HandleFunc("/", HomeHandler)

	fmt.Println("Listeing localhost:5000")
	log.Fatal(http.ListenAndServe(":5000", nil))
}
