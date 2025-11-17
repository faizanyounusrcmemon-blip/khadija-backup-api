async function uploadFileToDrive(drive, filePath, folderId) {
  const fileName = path.basename(filePath);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: "application/zip",
      parents: [String(folderId)]   // 🔥 FORCE STRING
    },
    media: {
      mimeType: "application/zip",
      body: fs.createReadStream(filePath)
    },
    fields: "id,name,parents"
  });

  return res.data;
}
