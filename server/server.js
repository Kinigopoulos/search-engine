const express = require("express");
const app = express();
const cors = require('cors');
const fs = require("fs");
const port = 5000;

//Erases content from given directory
function clearDataFromFolder(directory) {
    const fs = require('fs').promises;
    fs.rmdir(directory, {recursive: true})
        .then(() => console.log('directory removed!')).then(() => fs.mkdir(directory));
}

//Returns Top-K results of given query
async function searchPage(query, k = 5) {
    console.log("Searching top " + k + " results of: " + query);

    //Reading the word count from files and getting data from documents
    async function getDataFromFiles() {
        const terms = query.split(" ");
        let freqMap = new Map();
        let documentList = [];

        await terms.map(async (term, key) => {
            const path = './words/' + term;
            if (fs.existsSync(path)) {
                const data = fs.readFileSync(path, 'utf-8');
                const freq = data.split("\n");
                await freq.map(async f => {
                    if (f === "") return;
                    const line = f.split(" ");
                    const id = parseInt(line[0]);
                    const value = parseInt(line[1]);

                    const idExists = freqMap.has(id);
                    const arr = idExists ? freqMap.get(id) : new Array(terms.length).fill(0);
                    arr[key] = value;
                    freqMap.set(id, arr);
                    if (!idExists) {
                        const documentData = fs.readFileSync("./documents/" + id, 'utf-8');
                        const words = documentData.split("\n");
                        documentList.push([parseInt(words[0]), words[1], words[2]]);
                    }
                });
            }
        });
        return [freqMap, documentList, terms];
    }

    const [freqMap, documentList, terms] = await getDataFromFiles();

    //Return if there is not a single relevant document.
    const documentsSize = freqMap.size;
    if (documentsSize === 0) {
        return [];
    }

    //Constructing the TF-IDF array
    let frequencyArray = [];
    let idArray = [];
    freqMap.forEach((value, key) => {
        frequencyArray.push(value);
        idArray.push(key);
    });

    //Calculating IDF
    let idf = [];
    for (let i = 0; i < frequencyArray[0].length; i++) {
        let sum = 0;
        for (let j = 0; j < frequencyArray.length; j++) {
            sum += frequencyArray[j][i] !== 0 ? 1 : 0;
        }
        idf.push(Math.log10(documentList.length / sum));
    }

    //Calculating TD-IDF
    frequencyArray = frequencyArray.map((freqDoc, key) => {
        const count = documentList[key][0];

        return freqDoc.map((freqWord, key) => {
            const idfValue = idf[key];
            if (freqWord === 0) return 0;
            return (freqWord * idfValue) / count;
        });
    });

    //Cosine Similarity
    const queryLengthValue = Math.sqrt(terms.length);

    let topK = [];
    for(let i = 0; i < k; i++){
        topK.push({similarity: -0.1, document: null})
    }


    frequencyArray.forEach((freq, key) => {
        //Cosine calculation
        const sum = freq.reduce((accumulator, current) => accumulator + current, 0);
        let cosine;
        if (sum === 0) {
            cosine = 0;
        } else {
            const length = freq.reduce((accumulator, current) => accumulator + (current ** 2), 0);
            cosine = sum / (Math.sqrt(length) * queryLengthValue);
        }

        //Deciding if result is in top-K
        if (topK[k - 1].similarity < cosine) {
            let j;
            for (j = k - 2; j >= 0 && topK[j].similarity < cosine; j--) {
                topK[j + 1] = topK[j];
            }

            topK[j + 1] = {similarity: cosine, document: documentList[key], id: idArray[key], relevant: 0};
        }
    });

    //Adding relative words to each document
    topK.forEach(doc => {
        const t = freqMap.get(doc.id);
        if(t === undefined){
            return;
        }
        let relative = [];
        t.forEach((word, key) => {
            if(word !== 0){
                relative.push(terms[key]);
            }
        });
        doc.relativeWords = relative;
    });

    return topK;
}

async function getFeedback(query, R, NR){
    const a = 0.75;
    const b = -0.25;

    let terms = new Map();

    const w = query.split(" ");
    w.forEach(term => {
        terms.set(term, 1.0)
    });

    function calculate(table, constant) {
        if(table === undefined || table.length === 0){
            return;
        }
        const length = table.length;

        table.forEach(id => {
            const path = "./documents/" + id;
            const data = fs.readFileSync(path, 'utf-8');
            const words = data.split("\n");
            for (let i = 3; i < words.length; i++) {
                if (terms.has(words[i])) {
                    terms.set(words[i], terms.get(words[i]) + constant / length);
                } else {
                    terms.set(words[i], constant / length);
                }
            }
        })
    }

    calculate(R, a);
    calculate(NR, b);

    const mapSort = Array.from(new Map([...terms.entries()].sort((a, b) => b[1] - a[1])));

    let newQuery = "";
    let i = 0;
    while(i < w.length + 3 && mapSort[i][1] > 0.5){
        newQuery += mapSort[i][0] + " ";
        i++;
    }

    return newQuery;
}

app.get('/api/results', cors(), (req, res) => {
    const query = req.query.query;
    const k = req.query.k;
    searchPage(query.toLowerCase(), k).then(result => {
        res.json(result)
    });
});

app.get('/api/delete-files', cors(), (req, res) => {
    clearDataFromFolder("./documents");
    clearDataFromFolder("./words");
    res.end("Files deleted successfully!")
});

app.get('/api/feedback', cors(), (req, res) => {
    console.log("Finding new suitable query");

    getFeedback(req.query.query, req.query.R, req.query.NR).then(r => {
        console.log(r);
        res.end(r);
    }).catch(err => {
        console.log(err);
        res.end("404 error :(")
    });
});

app.get('/api/crawler', cors(), (req, res) => {
    console.log(req.query);
    const s = req.query;
    const child = require('child_process').spawn(
        'java', ['-jar', 'Crawler.jar', s.website, s.pages, (s.keep === 'true' ? "1" : "0"), s.threads]
    );

    child.stdout.on('data', function(data) {
        process.stdout.write(data.toString());
    });

    child.stderr.on("data", function (data) {
        process.stdout.write(data.toString());
    });

    res.json("done!");
});

app.listen(port, () => {
    console.log(`Engine listening on port ${port}!`)
});