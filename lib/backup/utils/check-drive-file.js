/** Fail closed unless Drive identifies the exact private archive we verified locally. */
export default function checkDriveFile(file, archive, folder) {
  return Boolean(
    file &&
    file.id &&
    file.name === archive.name &&
    file.ownedByMe === true &&
    !file.trashed &&
    file.mimeType === 'application/gzip' &&
    file.parents?.length === 1 &&
    file.parents[0] === folder &&
    String(file.size) === String(archive.size) &&
    file.sha256Checksum === archive.sha256 &&
    file.md5Checksum === archive.md5,
  );
}
