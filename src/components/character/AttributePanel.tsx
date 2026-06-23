import type { AttributesStore } from '../../domain/types'
import { ALL_ATTRIBUTES } from '../../domain/types'
import AttributeBar from './AttributeBar'

interface Props {
  attributes: AttributesStore
}

export default function AttributePanel({ attributes }: Props) {
  return (
    <div className="card">
      <div className="section-title">属性面板</div>
      <div className="space-y-4">
        {ALL_ATTRIBUTES.map(key => (
          <AttributeBar
            key={key}
            attrKey={key}
            state={attributes.items[key]}
          />
        ))}
      </div>
    </div>
  )
}
