import { useEffect, useState, useRef } from 'react'
import { 
  Box, Heading, Grid, Text, Button, Stack, Flex, Image, Show,
  AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader,
  AlertDialogContent, AlertDialogOverlay,
  Drawer, DrawerBody, DrawerFooter, DrawerHeader, DrawerOverlay, DrawerContent, DrawerCloseButton
} from '@chakra-ui/react'
import { useCartStore } from '../lib/cartStore'
import Link from 'next/link'
import { FiPlus, FiMinus } from 'react-icons/fi'

export default function CartDrawer({ isOpen, onClose }) {
  const { items, addItem, decreaseItem, removeItem, clearCart } = useCartStore()
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const [isAlertOpen, setIsAlertOpen] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState(null)
  const cancelRef = useRef()

  const handleDecreaseItem = (itemId) => {
    const item = items.find(item => item._id === itemId)
    if (item && item.quantity === 1) {
      setSelectedItemId(itemId)
      setIsAlertOpen(true)
    } else {
      decreaseItem(itemId)
    }
  }

  const handleRemoveConfirm = () => {
    removeItem(selectedItemId)
    setIsAlertOpen(false)
    setSelectedItemId(null)
  }

  const handleRemoveCancel = () => {
    setIsAlertOpen(false)
    setSelectedItemId(null)
  }

  const handleCheckout = () => {
    onClose()
  }

  return (
    <>
      <Drawer
        isOpen={isOpen}
        placement="right"
        onClose={onClose}
        size="md"
      >
        <DrawerOverlay />
        <DrawerContent
          bg="#fcd7d7"
          borderLeftColor="black"
          borderLeftWidth="4px"
        >
          <DrawerCloseButton 
            borderColor="black"
            borderWidth="1px"
            borderRadius="lg"
            boxShadow="2px 2px 0px 0px rgba(0, 0, 0, 1)"
            bg="white"
            m={2}
          />
          <DrawerHeader>
            <Heading size="xl" fontFamily={'nbHeading'}>Shopping Cart</Heading>
          </DrawerHeader>

          <DrawerBody>
            {items.length === 0 ? (
              <Text fontFamily={'nbHeading'}>There are no items in your cart</Text>
            ) : (
              <Stack spacing={6}>
                {items.map(item => (
                  <Flex
                    key={item._id}
                    bg="white"
                    p={4}
                    borderColor="black"
                    borderWidth={'2px'}
                    borderRadius="lg"
                    boxShadow="2px 2px 0px 0px rgba(0, 0, 0, 1)"
                    align="center"
                    justify="space-between"
                  >
                    <Flex align="center" gap={4}>
                      <Image
                        src={item.mainImage}
                        alt={item.name}
                        boxSize="100px"
                        objectFit="contain"
                      />
                      <Stack>
                        <Heading size="md" fontFamily={'nbText'}>{item.name}</Heading>
                        <Flex align="center" gap={3}>
                          <Button
                            size="sm"
                            onClick={() => handleDecreaseItem(item._id)}
                            aria-label="Decrease quantity"
                            borderColor="black"
                            borderWidth={'2px'}
                            borderRadius="lg"
                            boxShadow="1px 1px 0px 0px rgba(0, 0, 0, 1)"
                          >
                            <FiMinus />
                          </Button>
                          <Text>{item.quantity}</Text>
                          <Button
                            size="sm"
                            onClick={() => addItem(item)}
                            aria-label="Increase quantity"
                            borderColor="black"
                            borderWidth={'2px'}
                            borderRadius="lg"
                            boxShadow="1px 1px 0px 0px rgba(0, 0, 0, 1)"
                          >
                            <FiPlus />
                          </Button>
                        </Flex>
                        <Text fontFamily={'nbText'}>{(item.price * item.quantity || 0).toLocaleString()} UGX</Text>
                        <Button
                          colorScheme="red"
                          fontFamily={'nbText'}
                          variant="outline"
                          onClick={() => removeItem(item._id)}
                          size="sm"
                          borderColor="black"
                          borderWidth={'2px'}
                          borderRadius="lg"
                          boxShadow="2px 2px 0px 0px rgba(0, 0, 0, 1)"
                        >
                          Delete
                        </Button>
                      </Stack>
                    </Flex>
                  </Flex>
                ))}
              </Stack>
            )}
          </DrawerBody>

          {items.length > 0 && (
            <DrawerFooter borderTopWidth="4px" borderTopColor="black">
              <Box 
                bg="white" 
                p={6} 
                w="full"
                borderColor="black"
                borderWidth={'2px'}
                borderRadius="lg"
                boxShadow="4px 4px 0px 0px rgba(0, 0, 0, 1)"
              >
                <Stack spacing={4}>
                  <Flex justify="space-between">
                    <Text fontWeight="bold" fontFamily={'nbText'}>Total:</Text>
                    <Text fontWeight="bold" fontFamily={'nbText'}>{(total || 0).toLocaleString()} UGX</Text>
                  </Flex>
                  <Button
                    colorScheme="red"
                    size="lg"
                    fontFamily={'nbText'}
                    as={Link}
                    href="/checkout"
                    borderColor="black"
                    borderWidth={'2px'}
                    borderRadius="lg"
                    boxShadow="2px 2px 0px 0px rgba(0, 0, 0, 1)"
                    onClick={handleCheckout}
                  >
                    Proceed to Checkout
                  </Button>
                  <Button
                    variant="outline"
                    fontFamily={'nbText'}
                    onClick={clearCart}
                    borderColor="black"
                    borderWidth={'2px'}
                    borderRadius="lg"
                    boxShadow="2px 2px 0px 0px rgba(0, 0, 0, 1)"
                  >
                    Empty Cart
                  </Button>
                </Stack>
              </Box>
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>

      <AlertDialog
        isOpen={isAlertOpen}
        leastDestructiveRef={cancelRef}
        onClose={handleRemoveCancel}
      >
        <AlertDialogOverlay>
          <AlertDialogContent
            borderColor="black"
            borderWidth="2px"
            borderRadius="lg"
            boxShadow="4px 4px 0px 0px rgba(0, 0, 0, 1)"
          >
            <AlertDialogHeader fontSize="lg" fontFamily="nbHeading">
              Remove Item
            </AlertDialogHeader>

            <AlertDialogBody fontFamily="nbText">
              Are you sure you want to remove this item from cart?
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button 
                ref={cancelRef} 
                onClick={handleRemoveCancel}
                borderColor="black"
                borderWidth="1px"
                boxShadow="2px 2px 0px 0px rgba(0, 0, 0, 1)"
                fontFamily="nbText"
              >
                Cancel
              </Button>
              <Button 
                colorScheme="red" 
                onClick={handleRemoveConfirm} 
                ml={3}
                borderColor="black"
                borderWidth="1px"
                boxShadow="2px 2px 0px 0px rgba(0, 0, 0, 1)"
                fontFamily="nbText"
              >
                Remove
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  )
}

