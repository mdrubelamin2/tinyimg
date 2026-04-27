/** Column headers for {@link VirtualizedQueueTableBody}. */
export function QueueTableHeaderRow() {
  return (
    <div className="grid grid-cols-[28%_12%_45%_15%] w-full">
      <div className="px-3 py-3 text-left align-middle font-bold md:px-6 lg:px-8 md:py-4">
        File Name
      </div>
      <div className="px-3 py-3 text-left align-middle font-bold md:px-6 md:py-4">
        <span className="md:hidden">Orig.</span>
        <span className="hidden md:inline">Original</span>
      </div>
      <div className="px-3 py-3 text-left align-middle min-w-0 font-bold md:px-6 md:py-4">
        Status &amp; Formats
      </div>
      <div className="px-2 py-3 text-right align-middle font-bold md:px-6 md:py-4">
        <span className="md:hidden">Act.</span>
        <span className="hidden md:inline">Remove</span>
      </div>
    </div>
  );
}
