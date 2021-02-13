import React, {useState, useEffect} from "react";
import axios from "axios";
import './App.css';

function App() {
    const [mode, setMode] = useState("initial");
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [canChangeQuery, setCanChangeQuery] = useState(false);
    const [crawlerSettings, setCrawlerSettings] = useState(
        {website: "https://www.auth.gr/", pages: 1, keep: true, threads: 1});

    if (window.location.pathname === "/crawler") {
        if (mode !== "crawler") {
            setMode("crawler")
        }
    } else if ((window.location.pathname !== "/" && window.location.pathname !== "") && mode !== "search") {
        const words = window.location.pathname.split('/');
        if (words.length === 3 && words[1] === "search") {
            setMode("search");
            setQuery(decodeURIComponent(words[2]));
        }
    }

    useEffect(() => {
        async function getResultsFromQuery() {
            if (mode === "search") {
                let k = 10;
                let newQuery = query;
                if (newQuery.includes("(") && newQuery.includes(")")) {
                    const start = newQuery.indexOf("(");
                    const end = newQuery.indexOf(")");
                    k = newQuery.substring(start + 1, end);
                    newQuery = newQuery.replace(newQuery.substring(start, end + 1), "").trim();
                }

                axios.get('/api/results', {params: {query: newQuery, k: k}})
                    .then((response) => {
                            console.log(response);
                            setResults(response.data);
                        }
                    ).catch(() => console.log("Something went terribly wrong! :')"))
            }
        }

        getResultsFromQuery().then()
    }, [mode, query]);

    const setToInitial = e => {
        setMode("initial");
        window.location.href = "/";
    };

    const changeMode = param => () => {
        window.location.href = "/" + param;
    };

    const submitSearch = () => {
        if (query === '') {
            return;
        }
        window.location.href = "/search/" + encodeURIComponent(query);
    };

    const handleQueryChange = e => {
        setQuery(e.target.value);
    };

    const handleRelevantChange = e => {
        const id = e.target.id;
        let newArr = [...results];
        newArr[id].relevant = Number.parseInt(e.target.value);
        setResults(newArr);
        setCanChangeQuery(true);
    };

    const setSetting = e => {
        const newValue = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        setCrawlerSettings(settings => ({
            ...settings,
            [e.target.name]: newValue
        }));
    };

    const startCrawler = () => {
        console.log(crawlerSettings);
        axios.get('/api/crawler', {params: crawlerSettings}).then(res => {
            console.log(res)
        })
    };

    const feedback = e => {
        e.preventDefault(); // NB

        let R = [];
        let NR = [];
        results.forEach(result => {
            if(result.relevant === 1){
                R.push(result.id)
            } else if (result.relevant === -1){
                NR.push(result.id)
            }
        });

        axios.get('/api/feedback', {params: {R: R, NR: NR, query: query}})
            .then(res => {
            window.location.href = "/search/" + encodeURIComponent(res.data);
            }).catch(err => console.log(err));
    };

    function InitialMenu() {
        return (
            <>
                <div className="searchStuff">
                    <h1 className="searchTitle">Cool Search Engine</h1>
                    <form>
                        <input
                            type="text"
                            defaultValue={query}
                            className="searchInput"
                            onChange={handleQueryChange}
                            onKeyPress={(k) => {
                                if (k.key === 'Enter') {
                                    submitSearch();
                                    k.preventDefault()
                                }
                            }}
                        />
                    </form>
                    <button className="searchButton" onClick={submitSearch}>
                        Search
                    </button>
                    <button className="searchButton" onClick={changeMode("crawler")}>
                        Crawler Menu
                    </button>
                </div>
                <p className="helpText">Include (k) in your search, to set the number of results.<br/>
                    Example: "(30) hello world" returns top 30 results.</p>
            </>
        )
    }

    function CrawlerMenu() {
        return (
            <div>
                <h1 className="searchTitle">Cool Search Engine</h1>
                <div className="crawlerMenu">
                    <h2 className="crawlerTitle">Crawler Menu</h2>
                    <form>
                        <label className="crawlerLabelCont">
                            <h2 className="crawlerLabel">Starting Website</h2>
                            <input type="text" defaultValue={crawlerSettings.website}
                                   onChange={setSetting}
                                   name="website" className="searchInput addBottomMargin"/>
                        </label>
                        <label>
                            <h2 className="crawlerLabel">Pages to Collect</h2>
                            <input type="number" name="pages" defaultValue={crawlerSettings.pages}
                                   onChange={setSetting}
                                   min={1} className="searchInput addBottomMargin"/>
                        </label>
                        <label>
                            <h2 className="crawlerLabel">Keep Previous Pages</h2>
                            <input type="checkbox" defaultChecked={crawlerSettings.keep} name="keep"
                                   onChange={setSetting}
                                   className="searchInput addBottomMargin"/>
                        </label>
                        <label>
                            <h2 className="crawlerLabel">Number of Threads</h2>
                            <input type="number" name="threads" defaultValue={crawlerSettings.threads}
                                   onChange={setSetting}
                                   min={1} className="searchInput addBottomMargin"/>
                        </label>
                    </form>
                    <button className="searchButton" onClick={startCrawler}>
                        Start Crawling
                    </button>
                    <button className="searchButton" onClick={setToInitial}>
                        Back
                    </button>
                </div>
            </div>
        )
    }

    function SearchMenu() {
        return (
            <>
                <div className="searchStuffOnResults">
                    <h1 className="searchTitleOnResults">Cool Search Engine</h1>
                    <form>
                        <input
                            type="text"
                            defaultValue={query}
                            className="searchInput"
                            onChange={handleQueryChange}
                            onKeyPress={(k) => {
                                if (k.key === 'Enter') {
                                    submitSearch();
                                    k.preventDefault()
                                }
                            }}
                        />
                    </form>
                    <button className="searchButton searchButtonOnResults" onClick={submitSearch}>
                        Search
                    </button>

                    {canChangeQuery ?
                        <button className="feedbackButton searchButton searchButtonOnResults" onClick={feedback}>
                            Feedback
                        </button>
                        :
                        <button className="searchButton searchButtonOnResults" onClick={changeMode("crawler")}>
                            Crawler Menu
                        </button>
                    }
                </div>
                <div className="line"/>
                <div className="results">
                    {
                        results.map((result, key) => {
                            if (result.document === null) {
                                return "";
                            }
                            return (
                                <div className="resultContainer" key={result.id}>
                                    <h1 className="resultTitle">{result.document[2]}</h1>
                                    <a className="resultUrl" href={result.document[1]}>{result.document[1]}</a>
                                    <p className="resultDescription">
                                        <b>{"Relative Words: "}</b>
                                        {result.relativeWords.reduce((accumulator, currentText) => {
                                            return accumulator + " " + currentText;
                                        }, "")}
                                    </p>
                                    <div>
                                        <p className="resultsHelpful">Was this result helpful?</p>
                                        <form className="resultsForm">
                                            <input type="radio" id={key} name="relevant" value={1}
                                                   onChange={handleRelevantChange}/>
                                            <label>Yes</label>
                                            <input type="radio" id={key} name="relevant" value={-1}
                                                   onChange={handleRelevantChange}/>
                                            <label>No</label>
                                            <input type="radio" id={key} name="relevant" value={0}
                                                   onChange={handleRelevantChange}/>
                                            <label>Neutral</label>
                                        </form>
                                    </div>
                                    <div className="resultScore">
                                        <h2 className="resultSimilarity">
                                            {result.similarity.toFixed(2)}
                                        </h2>
                                    </div>
                                </div>
                            )
                        })
                    }
                    {results.length === 0 ? <p className="helpText">No Results</p> : ""}
                </div>
            </>
        )
    }


    return (
        <div className="App">
            {mode === "initial" ? InitialMenu() : ""}
            {mode === "crawler" ? CrawlerMenu() : ""}
            {mode === "search" ? SearchMenu() : ""}
        </div>
    );
}


export default App;
