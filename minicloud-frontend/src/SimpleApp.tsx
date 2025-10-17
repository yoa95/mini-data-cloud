import { RouterProvider } from 'react-router-dom'
import { router } from '@/lib/simple-router'

function SimpleApp() {
  return <RouterProvider router={router} />
}

export default SimpleApp