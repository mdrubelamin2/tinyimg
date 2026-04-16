/** Column headers for {@link VirtualizedQueueTableBody}. */
export function QueueTableHeaderRow() {
  return (
    <tr>
      <th scope="col" className="px-8 py-4 text-left align-middle font-bold">
        File Name
      </th>
      <th scope="col" className="px-6 py-4 w-[150px] min-w-[150px] text-left align-middle font-bold">
        Original
      </th>
      <th scope="col" className="px-6 py-4 text-left align-middle min-w-0 font-bold">
        Status &amp; Formats
      </th>
      <th scope="col" className="px-6 py-4 w-[100px] min-w-[100px] text-right align-middle font-bold">
        Remove
      </th>
    </tr>
  );
}
