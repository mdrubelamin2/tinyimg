export function QueueTableHeaderRow() {
  return (
    <div className='grid w-full grid-cols-[25%_15%_40%_20%]'>
      <div className='p-2 text-left align-middle font-bold md:px-6 md:py-4 lg:px-8'>File Name</div>
      <div className='p-2 text-left align-middle font-bold md:px-6 md:py-4'>
        <span className='md:hidden'>Orig.</span>
        <span className='hidden md:inline'>Original</span>
      </div>
      <div className='min-w-0 p-2 text-left align-middle font-bold md:px-6 md:py-4'>
        Status &amp; Formats
      </div>
      <div className='p-2 text-right align-middle font-bold md:px-6 md:py-4'>
        <span className='md:hidden'>Act.</span>
        <span className='hidden md:inline'>Remove</span>
      </div>
    </div>
  )
}
