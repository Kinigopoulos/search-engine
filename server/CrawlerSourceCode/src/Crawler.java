import org.jsoup.Connection;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Objects;
import java.util.Scanner;
import java.util.concurrent.atomic.AtomicInteger;

public class Crawler {

    private static final String DOCUMENTS_PATH = "./documents/";
    private static final String WORDS_PATH = "./words/";

    String startingWebsite; //Website for starting crawling
    int pages; //Number of pages to collect
    boolean keepPages; //Keep previous database if true or delete it
    int threads; //Number of threads

    int currentCollectedPages; //Keeping track of current collected pages
    int alreadyCollectedPages = 0; //Pages in database
    HashSet<String> visitedLinks; //Links that were visited
    HashSet<String> unvisitedLinks; //Links to visit

    //Crawler Constructor
    public Crawler(String website, int pages, boolean keepPages, int threads) {
        this.startingWebsite = website;
        this.pages = pages;
        this.keepPages = keepPages;
        this.threads = threads;
        currentCollectedPages = 0;

        visitedLinks = new HashSet<>();
        unvisitedLinks = new HashSet<>();

        //If it is decided to keep previous database, calculate the number of pages that are already collected
        //Else just erase everything.
        if(keepPages) {
            alreadyCollectedPages = Objects.requireNonNull(new File(DOCUMENTS_PATH).list()).length;
        } else {
            File doc = new File(DOCUMENTS_PATH);
            for(File file : Objects.requireNonNull(doc.listFiles()))
                file.delete();
            for(File file : Objects.requireNonNull(new File(WORDS_PATH).listFiles()))
                file.delete();
        }

        System.out.println("Ready for Crawling!");
    }

    //Initialize crawling procedure
    public void startCrawling() throws Exception {
        //First, add the starting website to the queue
        unvisitedLinks.add(startingWebsite);

        //Initialize crawlers
        Thread[] crawlers = new Thread[threads];
        for (int i = 0; i < threads; i++) {
            crawlers[i] = new Thread(new CrawlerThread());
            crawlers[i].start();
        }

        //Wait for them to finish, just to announce the end of program
        for (int i = 0; i < threads; i++) {
            crawlers[i].join();
        }
        System.out.println("Finished crawling!");
    }

    class CrawlerThread implements Runnable {
        String url; //Current url to visit

        //Gets links from current page and adds them to the queue if they aren't visited yet.
        synchronized void addPage(Elements links) {
            if (links != null) {
                for (Element link : links) {
                    String linkToVisit = link.attr("abs:href");
                    if (!visitedLinks.contains(linkToVisit)) {
                        unvisitedLinks.add(linkToVisit);
                    }
                }
            }
        }

        //Returns true only if all pages we asked for were collected
        synchronized boolean allPagesCollected() {
            return currentCollectedPages - 1 >= pages;
        }

        //Returns true if the queue is empty
        synchronized boolean isUnvisitedLinksEmpty() {
            return unvisitedLinks.isEmpty();
        }

        //Returns the first link from queue and also marks it as visited
        synchronized void getNewUrl() {
            url = unvisitedLinks.iterator().next();
            unvisitedLinks.remove(url);
            //visitedLinks.add(url);
        }

        //Returns a special identifier for the file
        synchronized int getId(){
            currentCollectedPages++;
            return alreadyCollectedPages + currentCollectedPages;
        }

        //Generic function to save a file
        synchronized void SaveFile(String fileName, String content) {
            try (Writer out = new BufferedWriter(new OutputStreamWriter(new FileOutputStream(fileName), StandardCharsets.UTF_8))) {
                out.write(content);
            } catch (IOException e) {
                e.printStackTrace();
            }
        }

        //Takes text as argument and keeps only the words from it. Then, it saves it to the suitable file with
        //its frequency and id. Returns the hashmap for further edit.
        HashMap<String, Integer> SaveWords(String text, int id){
            text = text.toLowerCase();
            text = text.replaceAll("[!?,.`~@#$%^’&*()«»“”_|+-=;:\\]\\['\"<>/]", "");
            String[] words = text.split("\\s+");

            HashMap<String, Integer> hashMap = new HashMap<>();
            for (String word : words){
                if(hashMap.containsKey(word)){
                    hashMap.replace(word, hashMap.get(word) + 1);
                }else{
                    hashMap.put(word, 1);
                }
            }
            hashMap.remove("");

            hashMap.forEach((k,v) -> saveWord(k, v, id));
            return hashMap;
        }

        //Saves word to suitable file, given the word name, value and id.
        synchronized private void saveWord(String key, Integer value, int id) {
            String path = WORDS_PATH + key;
            File f = new File(path);
            StringBuilder content = new StringBuilder();
            if(f.exists() && !f.isDirectory()) {
                try {
                    Scanner scanner = new Scanner(f);
                    while (scanner.hasNextLine()) {
                        content.append(scanner.nextLine()).append("\n");
                    }
                    scanner.close();
                } catch (Exception ignored) {

                }
            }
            content.append(id).append(" ").append(value).append("\n");
            SaveFile(path, content.toString());
        }

        //This is the main function of the thread.
        @Override
        public void run() {
            while (!allPagesCollected()) {
                try {
                    if (isUnvisitedLinksEmpty()) {
                        //If there is no link to go to just wait 0.5 seconds and try again.
                        Thread.sleep(500);
                    } else {
                        if (allPagesCollected()) return;
                        getNewUrl();

                        //Get response from url
                        Connection.Response response = SSLHelper.getConnection(url).ignoreContentType(true).userAgent("Mozilla").execute();

                        //Getting the real url (The starting url may redirect to a site that has been collected)
                        String actualUrl = response.url().toString();

                        //Checking if this url is in the list. Else, just add it in.
                        if(visitedLinks.contains(actualUrl)){
                            System.out.println("Site " + actualUrl + " exists. Aborting it...");
                            continue;
                        } else {
                            visitedLinks.add(actualUrl);
                        }

                        //If it is actual text/website add it (avoids pdf files)
                        if(response.contentType().contains("text") || response.contentType().contains("xml")) {
                            int id = getId();

                            Document doc = response.parse();
                            System.out.println(id + ". " + actualUrl);

                            Elements links = doc.select("a");
                            if (allPagesCollected()) return;
                            addPage(links);

                            //Save document with each word
                            HashMap<String, Integer> words = SaveWords(doc.text(), id);
                            StringBuilder stringBuilder = new StringBuilder();
                            AtomicInteger wordsLength = new AtomicInteger();
                            words.forEach((key, value) -> {
                                stringBuilder.append(key).append("\n");
                                wordsLength.addAndGet(value);
                            });

                            String content = wordsLength + "\n" + actualUrl + "\n" + doc.title() + "\n" + stringBuilder.toString();
                            SaveFile(DOCUMENTS_PATH + id, content);
                        }
                    }
                } catch (Exception ignored) {

                }
            }
        }
    }

}


