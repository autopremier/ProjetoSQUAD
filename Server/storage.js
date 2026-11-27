const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand
} = require("@aws-sdk/client-s3");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = new S3Client({
    endpoint: process.env.B2_ENDPOINT,
    region: process.env.B2_REGION,
    credentials: {
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_APPLICATION_KEY
    },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED"
});

const Bucket = process.env.B2_BUCKET;

async function uploadFile(key, body, contentType) {
    return s3.send(new PutObjectCommand({
        Bucket,
        Key: key,
        Body: body,
        ContentType: contentType
    }));
}

async function downloadFile(key) {
    return s3.send(new GetObjectCommand({
        Bucket,
        Key: key
    }));
}

async function deleteFile(key, versionId) {
    if (!versionId) {
        throw new Error("VersionId obrigatorio");
    }

    return s3.send(new DeleteObjectCommand({
        Bucket,
        Key: key,
        VersionId: versionId
    }));
}

async function signedUrl(key) {
    return getSignedUrl(
        s3,
        new GetObjectCommand({
            Bucket,
            Key: key
        }),
        { expiresIn: 900 }
    );
}

module.exports = {
    s3,
    uploadFile,
    downloadFile,
    deleteFile,
    signedUrl
};
