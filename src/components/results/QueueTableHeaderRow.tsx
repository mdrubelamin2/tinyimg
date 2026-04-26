/** Column headers for {@link VirtualizedQueueTableBody}. */
export function QueueTableHeaderRow() {
  return (
    <tr>
      <th scope="col" className="px-3 py-3 text-left align-middle font-bold md:px-6 lg:px-8 md:py-4">
        File Name
      </th>
      <th scope="col" className="px-3 py-3 text-left align-middle font-bold md:px-6 md:py-4">
        <span className="md:hidden">Orig.</span>
        <span className="hidden md:inline">Original</span>
      </th>
      <th scope="col" className="px-3 py-3 text-left align-middle min-w-0 font-bold md:px-6 md:py-4">
        Status &amp; Formats
      </th>
      <th scope="col" className="px-2 py-3 text-right align-middle font-bold md:px-6 md:py-4">
        <span className="md:hidden">Act.</span>
        <span className="hidden md:inline">Remove</span>
      </th>
    </tr>
  );
}
