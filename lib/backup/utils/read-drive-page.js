/** Reject missing or ambiguous pagination; a failed listing is never an empty folder. */
export default function readDrivePage(page, seenTokens) {
  if (
    !page ||
    !Array.isArray(page.files) ||
    page.incompleteSearch === true ||
    typeof page.has_more !== 'boolean' ||
    typeof page.nextPageToken !== 'string' ||
    page.has_more !== Boolean(page.nextPageToken) ||
    (page.nextPageToken && seenTokens.has(page.nextPageToken)) ||
    page.files.some((file) => typeof file.id !== 'string' || typeof file.name !== 'string')
  ) {
    throw new Error('drive-list-incomplete');
  }
  return { files: page.files, next: page.nextPageToken };
}
