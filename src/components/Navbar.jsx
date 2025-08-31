import { Box, Flex, Heading, Link, IconButton, Image, Text, useDisclosure } from '@chakra-ui/react'
import { FiShoppingCart } from 'react-icons/fi'
import CartIcon from './cartIcon.jsx'
import CartDrawer from './CartDrawer.jsx'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function NavBar() {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const router = useRouter()
  const { pathname } = router

  useEffect(() => {
    if (pathname !== '/') {
      setIsVisible(true)
      return
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrollingDown = currentScrollY > lastScrollY

      if (scrollingDown && isVisible) {
        setIsVisible(false)
      } else if (!scrollingDown && !isVisible) {
        setIsVisible(true)
      }

      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [isVisible, lastScrollY, pathname])

  return (
    <Box bg="#fcd7d7">
      <Flex
        as="nav"
        bg="white"
        p={4}
        justifyContent="space-between"
        alignItems="center"
        borderColor="black"
        borderBottomWidth={'3px'}
        style={{
          position: pathname === '/' ? 'fixed' : 'static',
          top: isVisible ? '0' : '-100px',
          width: '100%',
          transition: 'top 0.3s ease-in-out',
          zIndex: 1000,
        }}
      >
        <Box>
          <Image
              src={'https://res.cloudinary.com/medoptics-image-cloud/image/upload/v1745851600/image-black-2_m163vh.svg'}
              alt={'Little Kobe Logo'}
              h="50px"
              w="50px"
              objectFit="fit"
            />
        </Box>
        <Link href="/">
          <Text 
          fontSize={{base: 'md', lg: "1.5rem"}}
          ml={{base: 2, lg :8}}
          color="black"
          fontWeight={'600'}
          textAlign={'center'}
          fontFamily={'logoFont'}
          >Little Kobe Japanese Market
          </Text>
        </Link>
        <Flex gap={6}>
          <CartIcon onClick={onOpen} />
        </Flex>
      </Flex>
      
      <CartDrawer isOpen={isOpen} onClose={onClose} />
    </Box>
  )
}
