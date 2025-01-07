// importing dependencies//
const express = require('express');
const app = express();
const { chromium } = require('playwright');
//whois package for domain expiry date//
const whois = require('whois');
require('dotenv').config();
const PORT = 3500;
app.use(express.json());


// end point to check if a site is up or not and continues to check after 30 sec interval//

app.get('/:site', async(req, res) => {
    const checkSite = async () => {
        try {
                const response = await fetch(`https://${req.params.site}`)
                if (response.status == 200) {
                    console.log('this site is up')
                    return true
                } else {
                    console.log('This site is currently down')
                    return
            }
        } catch (err) {
            console.log(err.message)

        }
    }
        let issiteup = await checkSite()
        if(issiteup){
            res.redirect(`https://${req.params.site}`)
        }else{
            res.send('This site is currently down')
        }
        setInterval(checkSite, 30000)
    
})

// Another endpoint to test a site for expiration//
//this takes in the site name as a url param//

app.get("/siteExpiration/:domain", async (req, res) => {
    await whois.lookup(req.params.domain, (err, data) => {
        const parsedData = parseWhoisData(data)
        console.log(data)
        const currentTime = new Date()
        const expirationDate = parsedData['Registrar Registration Expiration Date']
        const dateObject = new Date(expirationDate)
        if (currentTime - dateObject <= 0) {
            console.log(`The domain: ${req.params.domain} is not expired yet`)
        } else {
            console.log(`This domain:${req.params.domain} is expired`)
        }
        if (err) {
            console.log(err.message)
        }
    })
})
// the parsing function was from chat gpt //
//to parse data from who is package//
function parseWhoisData(data) {
    const lines = data.split('\n');
    const result = {};
    lines.forEach(line => {
        const parts = line.split(':');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join(':').trim();
            result[key] = value;
        }
    });
    return result;
}
// 3rd endpoint for end to end testing and browser automation with playwright//
// this endpoint simply verifies data and then login is automated with playwright//

app.post('/testPage', (req, res) => {
    try {
        const { username, password } = req.body;
        if (username == process.env.FACEBOOK_USERNAME && password == process.env.FACEBOOK_PASSWORD) {
            console.log('request received')
            res.status(200).json({ 'message': 'request received' })
        } else {
            console.log('not allowed')
        }
    } catch (err) {
        console.log(err.message)
    }
});

app.listen(PORT, () => {
    console.log(`server running on port ${PORT}`);
    //playwright script is added in here to ensure server is running 
    // before tests are run//
    (async () => {
        const browser = await chromium.launch({ headless: false })
        const page = await browser.newPage()
        const jsondata = { username: process.env.FACEBOOK_USERNAME, password: process.env.FACEBOOK_PASSWORD }
        const response = await page.request.post('http://localhost:3500/testPage', {
            //stringify data before posting
            data: JSON.stringify(jsondata),
            headers: {
                'Content-Type': 'application/json'
            },
        })
        const status = response.status()
        if (status == 200) {
            console.log('endpoint accepted data')
            //proceeds to login with whatever data its given//
            await page.goto("https://www.facebook.com");
            await page.fill('input[name = "email"]', process.env.FACEBOOK_USERNAME);
            await page.fill('input[name = "pass"]', process.env.FACEBOOK_PASSWORD);
            await page.click('button[name = "login"]');
            await page.waitForNavigation({waitUntil : 'load'})
            console.log('facebook was successfully logged into');
            browser.close();
            //verifies successful login //
        } else {
            console.log('post request failed')
        }
    })();
})


