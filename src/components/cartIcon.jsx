import { FiShoppingCart } from 'react-icons/fi'
import { Badge, IconButton } from '@chakra-ui/react'
import { useCartStore } from '../lib/cartStore'
import { useEffect, useState } from 'react'

export default function CartIcon({ onClick }) {
  const [mounted, setMounted] = useState(false)
  const items = useCartStore(state => state.items)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <IconButton
      aria-label="View cart"
      icon={
        <>
          <FiShoppingCart size="24px" />
          {totalItems > 0 && (
            <Badge
              colorScheme="red"
              variant="solid"
              fontSize="0.8em"
              position="absolute"
              top="-4px"
              right="-4px"
              borderRadius="full"
            >
              {totalItems}
            </Badge>
          )}
        </>
      }
      variant="ghost"
      position="relative"
      onClick={onClick}
      _hover={{ bg: 'gray.100' }}
    />
  )
}

