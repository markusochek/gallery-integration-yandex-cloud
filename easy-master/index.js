const express = require('express');
const cors = require('cors');
const EasyYandexS3 = require("easy-yandex-s3");
const expressFileUpload = require('express-fileupload');
const { SQSClient, CreateQueueCommand, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand} = require("@aws-sdk/client-sqs");
const {Driver, getLogger, IamAuthService, getSACredentialsFromJson, TableDescription, Column,
    Types
} = require('ydb-sdk');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors())
app.use(expressFileUpload());

const s3 = new EasyYandexS3({
    auth: {
        'accessKeyId': "YCAJEVX4iLmxHWwU3n7Z6InlC",
        'secretAccessKey': "YCPNqKv682swLoxebhokTHfdQbcFUWp0TqbAeiof",
    },
    Bucket: "object-storage-grebnev",
    debug: false
});

const client = new SQSClient({
    'credentials' : {
        'accessKeyId': "YCAJEVX4iLmxHWwU3n7Z6InlC",
        'secretAccessKey': "YCPNqKv682swLoxebhokTHfdQbcFUWp0TqbAeiof",
    },
    'region': 'ru-central1',
    'endpoint': 'https://message-queue.api.cloud.yandex.net',
});

const queueUrl = "https://message-queue.api.cloud.yandex.net/b1gt5r86r6tkhatg9ltm/dj600000001g9nqk05su/message-queue-grebnev"

async function sendMessage(queueUrl, message) {
    const input = {
        QueueUrl: queueUrl,
        MessageBody : message
    };
    let response = await client.send(new SendMessageCommand(input))
    return response['MessageId']
}

async function receiveMessage(queueUrl) {
    const input = {
        QueueUrl: queueUrl,
        WaitTimeSeconds: Number(1),
    }
    return client.send(new ReceiveMessageCommand(input))
}

async function deleteMessage(queueUrl, res) {
    const inputDelete = {
        QueueUrl: queueUrl,
        WaitTimeSeconds: Number(1),
        ReceiptHandle: res['Messages'][0]['ReceiptHandle'],
    }
    return client.send(new DeleteMessageCommand(inputDelete))
}
async function init() {
    this.logger = getLogger({level: 'debug'});
    const endpoint = 'grpcs://ydb.serverless.yandexcloud.net:2135';
    const database = '/ru-central1/b1gt5r86r6tkhatg9ltm/etnf6f84qpet3koe51ik';
    const saCredentials = getSACredentialsFromJson("authorized_key.json");
    const authService = new IamAuthService(saCredentials);
    this.driver = new Driver({endpoint, database, authService});
    if (!await this.driver.ready(10000)) {
        this.logger.fatal(`Driver has not become ready in 10 seconds!`);
        process.exit(1);
    }
}

app.post("/api/images", async function (request, response) {
    await init()
    const upload = await s3.Upload({buffer: request.files.file.data}, "/gaika/");
    await sendMessage(queueUrl, upload.key);
    // await createTable().then(() => {})
    let image = {
        createdAt: new Date(request.body.createdAt),
        name: request.body.name,
        fileSize: request.body.fileSize,
        height: request.body.height,
        width: request.body.width,
    }
    await addImageDB(image, upload.key);
    response.send(
        {
            statusCode: 200,
            filePath: upload.key
        }
    )
});

app.get("/api/images", async function (request, response) {
    await init()
    let allImages = [];
    // let allImagesURLAndName = getAllImagesURLAndName()
    getAllImagesURLAndName().then(allImagesURLAndName => {
        let promiseFunctions = []
        for (let key in allImagesURLAndName) {
            promiseFunctions.push(new Promise((resolve, reject) => {
                s3.Download(allImagesURLAndName[key].smallFilePath).then(downloadImage => {
                    allImages.push({
                        buffer: Buffer.from(downloadImage['data']['Body']).toString('base64'),
                        filePath: allImagesURLAndName[key].smallFilePath,
                    })
                    resolve()
                })
            }))
        }
        Promise.all(promiseFunctions)
        .then(() => {
            response.send(
                allImages
            )
        })
    })
});

app.delete('/api/images/', async function (request, response) {
    await init()
    await deleteImage(request.query.filePath).then(() => {
        response.send({
            statusCode: 200,
            body: true
        })
    })
});

app.get('/api/images/original', async function (request, response) {
    await init()
    await getImageBySmallFilePath(request.query.filePath).then(filePath => {
        s3.Download(filePath).then(downloadImage => {
            response.send(
                {
                    buffer: Buffer.from(downloadImage['data']['Body']).toString('base64')
                }
            )
        })
    })
});

async function getAllImagesURLAndName() {
    return await this.driver.tableClient.withSession(async (session) => {
        const query = `
            SELECT small_file_path,
                    name,
                   created_at
            FROM images 
            ORDER BY created_at DESC;`;
        const {resultSets} = await session.executeQuery(query);

        const resultSet = resultSets[0]
        const allImages = []
        for (let i = 0; i < resultSet.rows.length; i++)
        {
            const smallFilePath = resultSet.rows[i].items[0].textValue
            const name = resultSet.rows[i].items[1].textValue
            allImages.push({smallFilePath, name})
        }
        return allImages
    })
}

async function createTable() {
    await this.driver.tableClient.withSession(async (session) => {
        this.logger.info('Creating tables...');
        await session.createTable('images',
            new TableDescription()
                .withColumn(new Column('name', Types.UTF8))
                .withColumn(new Column('file_path', Types.UTF8,))
                .withColumn(new Column('created_at', Types.DATE,))
                .withColumn(new Column('small_file_path', Types.optional(Types.UTF8),))
                .withColumn(new Column('file_size', Types.optional(Types.UINT64),))
                .withColumn(new Column('height', Types.optional(Types.UINT64),))
                .withColumn(new Column('width', Types.optional(Types.UINT64),))
                .withPrimaryKey('file_path')
        );
    });
}
async function addImageDB(image, uploadKey) {
    return await this.driver.tableClient.withSession(async (session) => {
        const dateString = image.createdAt.getFullYear() + "-" + (image.createdAt.getMonth() + 1) + "-" + image.createdAt.getDay();
        const query = `
                INSERT INTO images
                (name, file_path, created_at, file_size, height, width) VALUES
                ("${image.name}", "${uploadKey}", Date("${dateString}"), ${image.fileSize}, ${image.height}, ${image.width});
                `;
        await session.executeQuery(query);
    });
}

async function deleteImage(filePath) {
    return await this.driver.tableClient.withSession(async (session) => {
        const query = `
            SELECT file_path,
                   small_file_path
            FROM images WHERE file_path = '${filePath}'`;
        const {resultSets} = await session.executeQuery(query);
        const resultSet = resultSets[0]
        const resultJson = []
        for (let i = 0; i < resultSet.rows.length; i++)
        {
            const filePath = resultSet.rows[i].items[0].textValue
            let small_file_path = resultSet.rows[i].items[1].textValue
            const filePathArr = filePath.split("/")
            let filePathToDelete = filePathArr[filePathArr.length-2] + "/" + filePathArr[filePathArr.length-1]
            await s3.Remove(filePathToDelete)
            await s3.Remove(small_file_path)
            resultJson.push(filePath)
        }

        for (let i = 0; i<resultJson.length; i++)
        {
            await deletePhotoByPathFromTable(resultJson[i])
        }

    });
}

async function deletePhotoByPathFromTable(filePath){
    return await this.driver.tableClient.withSession(async (session) => {
        const query = `
            DELETE FROM images 
            WHERE file_path = "${filePath}";`
        console.log(query)
        await session.executeQuery(query);
    });

}

async function getImageBySmallFilePath(smallFilePath) {
    return await this.driver.tableClient.withSession(async (session) => {
        const query = `
            SELECT file_path
            FROM images WHERE small_file_path = '${smallFilePath}'`;
        const {resultSets} = await session.executeQuery(query);
        const resultSet = resultSets[0]
        return resultSet.rows[0].items[0].textValue
    })
}

app.listen(3000);
// app.listen(process.env.PORT, () => {
//     console.log(`App listening at port ${process.env.PORT}`);
// });

