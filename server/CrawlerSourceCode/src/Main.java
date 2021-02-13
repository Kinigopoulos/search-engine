public class Main {

    //Default values
    static final String defaultWebsite = "https://www.auth.gr/";
    static final int defaultPages = 100;
    static final boolean defaultKeepPages = true;
    static final int defaultThreads = 5;

    public static void main(String[] args) throws Exception {

        //Assign default values in case of wrong args
        String website = defaultWebsite;
        int pages = defaultPages;
        boolean keepPages = defaultKeepPages;
        int threads = defaultThreads;

        //Try to assign every argument to the variables
        try{
            website = args[0];
            pages = Integer.parseInt(args[1]);
            keepPages = args[2].equals("1");
            threads = Integer.parseInt(args[3]);
        }catch (Exception ignored){

        }

        System.out.println("Starting website: " + website + ", " + pages + ", " + keepPages + ", " + threads);

        //Initiate Crawler class
        Crawler crawler = new Crawler(website, pages, keepPages, threads);
        crawler.startCrawling();
    }

}
