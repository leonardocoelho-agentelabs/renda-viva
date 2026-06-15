export default function AssinarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0F172A] flex items-center justify-center p-4">
      {children}
    </div>
  )
}
