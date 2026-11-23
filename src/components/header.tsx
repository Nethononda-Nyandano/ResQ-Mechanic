import {View, Text, Image} from 'react-native'
import React from 'react'

const Header = ({title}: {title: string}) => {
    return (
        <View className='px-6 pt-3 flex-row items-center justify-between '>
            <View>
                <Text className='text-2xl font-poppin-bold text-gray-800'>{title}</Text>
                <Text className='text-xs tracking-wider'>mobile mechanic</Text>


            </View>
            
            <Image source={require("@/assets/images/logo4.png")} className='w-24 h-7 object-contain' />
        </View>
    )
}
export default Header
