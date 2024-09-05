const express = require('express');
const expressFileUpload = require('express-fileupload');
const fs = require('fs');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(expressFileUpload());

app.get("/", async function (request, response) {
    response.sendFile(__dirname + "/index.html")
})
app.get("/main.js", async function (request, response) {
    response.sendFile(__dirname + "/main.js")
})
app.get("/style.css", async function (request, response) {
    response.sendFile(__dirname + "/style.css")
})
app.get("/favicon.ico", async function (request, response) {
    response.sendFile(__dirname + "/favicon.ico")
})

app.listen(3001);
// app.listen(process.env.PORT, () => {
//     console.log(`App listening at port ${process.env.PORT}`);
// });