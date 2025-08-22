package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"text/template"
)

var JSCourse courseData
var (
	key = []byte("qd!H%~0R3uvuKE2j96z2Q!d/ET<J#2Ya")
)

type unitLessonID struct {
	unitid   int
	lessonid int
}
type courseData struct {
	unitCount   int
	lessonCount []int
}

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

type LessonPage struct {
	UnitID     int
	LessonID   int
	LessonData Lesson
	Next       string
	Prev       string
}

func updateCompleted(unitid int, lessonid int, completed bool) {
	currUnit, err := getUnit(unitid)
	if err != nil {
		fmt.Println("Warning! updateCompleted called on invalid unit")
		return
	}
	if lessonid < 0 || lessonid > len(currUnit.Lessons) {
		fmt.Println("Warning! updateCompleted called on invalid lesson")
		return
	}
	currUnit.Lessons[lessonid].Completed = completed

	jsondata, err := json.Marshal(currUnit)
	if err != nil {
		fmt.Println("Could not Marshal the Unit updating completed")
		return
	}

	encodedJson := xorEncode(jsondata)

	path := fmt.Sprintf("./public/units/unit-%d.bin", unitid)
	file, err := os.OpenFile(path, os.O_RDWR|os.O_CREATE, 0644)
	if err != nil {
		fmt.Printf("Something went wrong opening the unit file\n  %s\n", err)
		return
	}
	defer file.Close()
	file.Truncate(0)
	file.Seek(0, 0)

	_, err = file.Write(encodedJson)
	if err != nil {
		fmt.Println(err.Error())
	}
}

func getPrev(unitid int, lessonid int) (unitLessonID, error) {
	ret := unitLessonID{
		unitid:   unitid,
		lessonid: lessonid,
	}

	ret.lessonid = ret.lessonid - 1
	if ret.lessonid < 0 {
		ret.unitid = ret.unitid - 1

		if ret.unitid < 0 {
			return unitLessonID{}, errors.New("No previous Unit")
		}
		currUnitLessonsCount := JSCourse.lessonCount[ret.unitid]
		ret.lessonid = currUnitLessonsCount - 1
	}

	return ret, nil
}
func getNext(unitid int, lessonid int) (unitLessonID, error) {
	ret := unitLessonID{
		unitid:   unitid,
		lessonid: lessonid,
	}

	currUnitLessonsCount := JSCourse.lessonCount[ret.unitid]

	ret.lessonid = ret.lessonid + 1

	if ret.lessonid >= currUnitLessonsCount {
		ret.unitid = ret.unitid + 1
		ret.lessonid = 0

		if ret.unitid >= JSCourse.unitCount {
			return unitLessonID{}, errors.New("No next lesson")
		}

		currUnitLessonsCount = JSCourse.lessonCount[ret.unitid]
		if currUnitLessonsCount == 0 {
			return unitLessonID{}, errors.New("Next Unit has no Lessons")
		}
	}

	return ret, nil
}

func xorEncode(text []byte) []byte {
	res := make([]byte, len(text))

	for i := range text {
		res[i] = text[i] ^ key[i%len(key)]
	}
	return res
}

func getUnitJSON(unitid int) ([]byte, error) {
	path := fmt.Sprintf("./public/units/unit-%d.bin", unitid)
	jsondata, err := os.ReadFile(path)
	if err != nil {
		return []byte{}, errors.New(err.Error())
	}

	decodedJson := xorEncode(jsondata)

	return decodedJson, nil
}

func getUnit(unitid int) (Unit, error) {
	jsonData, err := getUnitJSON(unitid)
	if err != nil {
		return Unit{}, errors.New(err.Error())
	}

	var unit Unit
	err = json.Unmarshal(jsonData, &unit)
	if err != nil {
		fmt.Printf("Unmarshal error : %s\n", err)
	}

	return unit, nil
}

func homeHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.Redirect(w, r, "/", http.StatusFound)
	}
	var units []Unit
	i := 0

	currUnit, err := getUnit(i)

	for err == nil {
		units = append(units, currUnit)

		i += 1
		currUnit, err = getUnit(i)
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
func DiffStrings(a, b string) string {
	minLen := len(a)
	if len(b) < minLen {
		minLen = len(b)
	}

	for i := 0; i < minLen; i++ {
		if a[i] != b[i] {
			return fmt.Sprintf(
				"Mismatch at index %d:\nString A: %q\nString B: %q",
				i, a[i:], b[i:],
			)
		}
	}

	if len(a) != len(b) {
		return fmt.Sprintf(
			"Strings match up to index %d but lengths differ:\nString A: %q\nString B: %q",
			minLen, a, b,
		)
	}

	return "Strings are identical"
}

func checkResultHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		fmt.Println("Invalid Request Method")
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	path := r.URL.Path

	parts := strings.Split(path, "/")

	if len(parts) != 4 {
		fmt.Println("Invalid Lesson Path")
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	unitid, err := strconv.Atoi(parts[2])
	if err != nil {
		fmt.Println("Invalid Lesson request: Unit ID not an int")
		http.Error(w, "Bad Request", http.StatusBadRequest)
	}

	unitObj, err := getUnit(unitid)
	if err != nil {
		fmt.Printf("Unit %d not found", unitid)
		http.NotFound(w, r)
	}

	lessonid, err := strconv.Atoi(parts[3])
	if err != nil {
		fmt.Println("Invalid Lesson request: Lesson ID not an int")
		http.Error(w, "Bad Request", http.StatusBadRequest)
	}

	if lessonid > len(unitObj.Lessons)-1 {
		fmt.Printf("Lesson %d.%d not found", unitid, lessonid)
		http.NotFound(w, r)
	}
	lesson := unitObj.Lessons[lessonid]

	toCheck := r.FormValue("result")
	re, err := regexp.Compile(lesson.ExpectedResult)
	if err != nil {
		log.Fatalf("Failed to compile regular expression \"%s\":\n    %s\n", lesson.ExpectedResult, err.Error())
	}
	resultCorrect := re.Match([]byte(toCheck))

	go updateCompleted(unitid, lessonid, resultCorrect)

	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "%t", resultCorrect)
}

func jsonHandler(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	parts := strings.Split(path, "/")

	if len(parts) < 3 || len(parts) > 4 {
		fmt.Println("Invalid Lesson Path")
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	unitid, err := strconv.Atoi(parts[2])
	if err != nil {
		fmt.Println("Invalid Lesson request: Unit ID not an int")
		http.Error(w, "Bad Request", http.StatusBadRequest)
	}

	if len(parts) == 3 {
		unitJson, err := getUnitJSON(unitid)
		if err != nil {
			fmt.Printf("Unit %d not found", unitid)
			http.NotFound(w, r)
		}
		w.Write(unitJson)
		return
	}

	unitObj, err := getUnit(unitid)
	if err != nil {
		fmt.Printf("Unit %d not found", unitid)
		http.NotFound(w, r)
	}
	lessonid, err := strconv.Atoi(parts[3])
	if err != nil {
		fmt.Println("Invalid Lesson request: Lesson ID not an int")
		http.Error(w, "Bad Request", http.StatusBadRequest)
	}

	if lessonid > len(unitObj.Lessons)-1 {
		fmt.Printf("Lesson %d.%d not found", unitid, lessonid)
		http.NotFound(w, r)
	}

	json.NewEncoder(w).Encode(unitObj.Lessons[lessonid])
}

func lessonHandler(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	parts := strings.Split(path, "/")

	if len(parts) != 4 {
		fmt.Println("Invalid Lesson Path")
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	unitid, err := strconv.Atoi(parts[2])
	if err != nil {
		fmt.Println("Invalid Lesson request: Unit ID not an int")
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	unitObj, err := getUnit(unitid)
	if err != nil {
		fmt.Printf("Unit %d not found\n", unitid)
		http.NotFound(w, r)
		return
	}

	lessonid, err := strconv.Atoi(parts[3])
	if err != nil {
		fmt.Println("Invalid Lesson request: Lesson ID not an int")
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	if lessonid > len(unitObj.Lessons)-1 {
		fmt.Printf("Lesson %d.%d not found", unitid, lessonid)
		http.NotFound(w, r)
		return
	}

	index := template.Must(template.New("index").Funcs(template.FuncMap{
		"strEq": func(a, b string) bool { return a == b },
	}).ParseFiles("./public/views/lesson.html"))

	next, err := getNext(unitid, lessonid)
	nextStr := "-1"
	if err == nil {
		nextStr = fmt.Sprintf("%d,%d", next.unitid, next.lessonid)
	}

	prev, err := getPrev(unitid, lessonid)
	prevStr := "-1"
	if err == nil {
		prevStr = fmt.Sprintf("%d,%d", prev.unitid, prev.lessonid)
	}

	data := struct {
		UnitID   int
		LessonID int
		UnitData Unit
		Next     string
		Prev     string
	}{
		UnitID:   unitid,
		LessonID: lessonid,
		UnitData: unitObj,
		Next:     nextStr,
		Prev:     prevStr,
	}
	index.ExecuteTemplate(w, "lesson.html", data)

}

func staticHandler(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	parts := strings.Split(path, "/")
	if len(parts) != 4 {
		fmt.Println("Invalid Static Path")
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	fileType := parts[2]
	reqFile := parts[3]

	var filePath string
	switch fileType {
	case "css":
		filePath = fmt.Sprintf("./public/css/%s", reqFile)
	case "js":
		filePath = fmt.Sprintf("./public/js/%s", reqFile)
	case "fonts":
		filePath = fmt.Sprintf("./public/fonts/%s", reqFile)
	}
	http.ServeFile(w, r, filePath)
}

func loadCourse(Course *courseData) {
	dir, err := os.ReadDir("./public/units")
	if err != nil {
		log.Fatal("No Units \n")
	}
	re := regexp.MustCompile(`unit\-(\d+)\.bin`)

	for _, file := range dir {
		fmt.Printf("checking file: %s\n", file.Name())
		unitidStr := re.FindStringSubmatch(file.Name())[1]

		if unitidStr != "" {
			Course.unitCount = Course.unitCount + 1
			Course.lessonCount = append(Course.lessonCount, 0)

			unitid, err := strconv.Atoi(unitidStr)

			if err != nil {
				log.Fatal("This should not happen")
			}

			unitJson, err := getUnit(unitid)
			if err != nil {
				log.Fatal("Unit found with no json")
			}

			Course.lessonCount[unitid] = len(unitJson.Lessons)
		}
	}
}
func main() {
	loadCourse(&JSCourse)

	http.HandleFunc("/static/", staticHandler)
	http.HandleFunc("/lesson/", lessonHandler)
	http.HandleFunc("/getjson/", jsonHandler)
	http.HandleFunc("/checkresult/", checkResultHandler)
	http.HandleFunc("/", homeHandler)

	fmt.Println("Listening localhost:5000")
	log.Fatal(http.ListenAndServe(":5000", nil))
}
